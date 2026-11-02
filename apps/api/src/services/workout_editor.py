"""Changing a finished workout: it's rescored as things stood when it was logged."""

import uuid
from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta

from db.repositories.feed_repository import FeedRepository
from db.repositories.personal_record_repository import PersonalRecordRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.workout_repository import WorkoutRepository
from db.tables.point_event import PointEvent
from db.tables.workout import Workout
from services.activity_service import workout_post_vars
from services.bonus_service import BonusService
from services.catalog import Catalog
from services.climb_service import ClimbService
from services.errors import WorkoutEditExpired, WorkoutNotFound
from services.member import Member
from services.scoring_context import ScoringContextBuilder
from services.scoring_service import best_sets, score_workout
from services.scoring_types import LineItem, RecordSet, ScoreResult, ScoringRules
from services.training_rules import week_start
from services.workout_finisher import nothing_to_pay
from services.workout_mapping import to_rows, to_workout_log
from services.workout_service import WorkoutService
from services.workout_types import ExerciseEntry, FinishedWorkout

# Paid on top of the workout, and not taken back when it changes.
_KEPT_KEYS = frozenset({"ln_quest", "ln_crew_quest", "ln_bounty", "ln_badge", "ln_duel"})


@dataclass(frozen=True, slots=True)
class WorkoutChanges:
    """What can change: the same things the logger saves."""

    name: str | None
    entries: tuple[ExerciseEntry, ...]
    change_gym: bool = False
    gym: str | None = None


class WorkoutEditor:
    # Ties rescoring together, like WorkoutFinisher, so it holds as many collaborators.
    # pylint: disable=too-many-instance-attributes
    """Replaces what a workout paid. Bonuses stay, other workouts and nobody's inbox change."""

    def __init__(
        self,
        workouts: WorkoutService,
        climb: ClimbService,
        workout_rows: WorkoutRepository,
        context: ScoringContextBuilder,
        records: PersonalRecordRepository,
        events: PointEventRepository,
        feed: FeedRepository,
        catalog: Catalog,
        rules: ScoringRules,
        bonus: BonusService,
        window: timedelta,
        now: Callable[[], datetime],
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._workouts = workouts
        self._climb = climb
        self._rows = workout_rows
        self._context = context
        self._records = records
        self._events = events
        self._feed = feed
        self._catalog = catalog
        self._rules = rules
        self._bonus = bonus
        self._window = window
        self._now = now

    async def edit(self, member: Member, workout_id: uuid.UUID, changes: WorkoutChanges) -> None:
        """Apply the changes and rescore. Two edits at once can't both replace the points."""
        await self._events.lock(f"edit:{workout_id}")
        workout = await self._own_finished(member, workout_id)
        paid = await self._events.for_workout(workout.id)
        logged_at = self._check_window(workout, paid)
        kept = [self._copy(event) for event in paid if event.key in _KEPT_KEYS]
        before = await self._climb.totals(member)
        exercises = {row.exercise_id for row in workout.sets}
        await self._apply(member, workout, changes)
        others = await self._others(member, workout)
        await self._events.delete_for_workout(workout.id)
        score, count = await self._score(member, workout, await self._earlier(others, logged_at))
        await self._store(member, workout, score, kept, logged_at)
        await self._settle_records(member, workout, others, exercises)
        bonus = await self._bonus.after_workout(member, workout, before)
        workout.points = sum(e.points for e in await self._events.for_workout(workout.id))
        await self._rows.save(workout)
        await self._update_post(member, workout, score, count, before, bonus)

    async def _own_finished(self, member: Member, workout_id: uuid.UUID) -> Workout:
        workout = await self._rows.get(workout_id)
        if workout is None or workout.user_id != member.user.id or workout.finished_at is None:
            raise WorkoutNotFound(str(workout_id))
        return workout

    def _check_window(self, workout: Workout, paid: Sequence[PointEvent]) -> datetime:
        """When it was logged, which a past day's own date doesn't say: when its points arrived."""
        logged_at = min((event.created_at for event in paid), default=None)
        if logged_at is None or self._now() > logged_at + self._window:
            raise WorkoutEditExpired(str(workout.id))
        return logged_at

    @staticmethod
    def _copy(event: PointEvent) -> PointEvent:
        return PointEvent(
            user_id=event.user_id,
            crew_id=event.crew_id,
            workout_id=event.workout_id,
            key=event.key,
            vars=dict(event.vars),
            points=event.points,
            week_start=event.week_start,
            created_at=event.created_at,
        )

    async def _apply(self, member: Member, workout: Workout, changes: WorkoutChanges) -> None:
        for entry in changes.entries:
            self._workouts.check_exercise(entry.exercise_id)
        if changes.name is not None and changes.name.strip():
            workout.name = changes.name.strip()
        if changes.change_gym:
            await self._workouts.set_gym(member, workout, changes.gym)
        workout.sets = to_rows(changes.entries)
        await self._rows.save(workout)

    async def _others(self, member: Member, workout: Workout) -> list[Workout]:
        rows = await self._rows.finished_by_user(member.user.id)
        return [other for other in rows if other.id != workout.id]

    async def _earlier(self, others: list[Workout], logged_at: datetime) -> list[Workout]:
        """Logged before this one, which is what its points were measured against."""
        logged = await self._events.logged_times([other.id for other in others])
        return [w for w in others if w.id in logged and logged[w.id] < logged_at]

    async def _score(
        self, member: Member, workout: Workout, earlier: list[Workout]
    ) -> tuple[ScoreResult, int]:
        moment = workout.finished_at
        assert moment is not None
        this_week = week_start(moment, member.crew.time_zone)
        count = sum(1 for other in earlier if other.week_start == this_week)
        week = replace(await self._context.week(member, moment), workouts_before=count)
        history = await self._context.history(member, workout, moment, before=moment)
        bests = self._best_records(earlier)
        history = replace(
            history, personal_records={key: held[0].e1rm for key, held in bests.items()}
        )
        log = to_workout_log(workout, self._catalog)
        score = score_workout(log, history, week, self._rules)
        if not score.line_items:
            raise nothing_to_pay(log, workout.id)
        return score, count + (1 if score.completed_sets else 0)

    def _best_records(self, workouts: list[Workout]) -> dict[str, tuple[RecordSet, Workout]]:
        """The best set per exercise across these workouts, and the workout that holds it."""
        best: dict[str, tuple[RecordSet, Workout]] = {}
        for workout in workouts:
            log = to_workout_log(workout, self._catalog)
            for record in best_sets(log, self._rules):
                held = best.get(record.exercise_id)
                if held is None or record.e1rm > held[0].e1rm:
                    best[record.exercise_id] = (record, workout)
        return best

    async def _store(
        self,
        member: Member,
        workout: Workout,
        score: ScoreResult,
        kept: list[PointEvent],
        logged_at: datetime,
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        """The new lines take the place of the old ones, dated when the points first arrived."""
        moment = workout.finished_at
        assert moment is not None
        this_week = week_start(moment, member.crew.time_zone)
        workout.week_start = this_week if score.completed_sets else None
        workout.volume_kg = score.volume_kg
        workout.effort_km = score.effort_km
        lines = [
            PointEvent(
                user_id=member.user.id,
                crew_id=member.crew.id,
                workout_id=workout.id,
                key=item.key,
                vars=dict(item.vars),
                points=item.points,
                week_start=this_week,
                created_at=logged_at,
            )
            for item in score.line_items
        ]
        await self._events.add_all([*lines, *kept])

    async def _settle_records(
        self, member: Member, workout: Workout, others: list[Workout], exercises: set[str]
    ) -> None:
        """Each PR this could touch goes to whichever workout now holds the best set. One set by
        another workout stays unless this one beats it."""
        stored = {r.exercise_id: r for r in await self._records.for_user(member.user.id)}
        winners = self._best_records([*others, workout])
        now_here = {row.exercise_id for row in workout.sets}
        held_here = {key for key, row in stored.items() if row.workout_id == workout.id}
        for exercise_id in exercises | now_here | held_here:
            row, winner = stored.get(exercise_id), winners.get(exercise_id)
            if row is not None and row.workout_id != workout.id:
                if winner is None or row.e1rm >= winner[0].e1rm:
                    continue
            if winner is None:
                if row is not None:
                    await self._records.delete(member.user.id, exercise_id)
                continue
            record, holder = winner
            assert holder.finished_at is not None
            await self._records.store(member.user.id, record, holder.id, holder.finished_at)

    async def _update_post(
        self,
        member: Member,
        workout: Workout,
        score: ScoreResult,
        count: int,
        before: dict[uuid.UUID, int],
        bonus: list[LineItem],
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        """The crew sees the corrected numbers on the same post, marked as edited."""
        post = await self._feed.workout_post(workout.id)
        if post is None:
            return
        after = await self._climb.totals(member)
        climb = await self._climb.change(member, before, after)
        finished = FinishedWorkout(workout, score, count, climb, tuple(bonus))
        post.vars = {**workout_post_vars(workout, finished), "edited": True}
