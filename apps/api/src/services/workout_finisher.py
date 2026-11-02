"""Finishing a workout: score it, store the point events and PRs, close it."""

import uuid
from collections.abc import Callable
from datetime import datetime

from db.repositories.personal_record_repository import PersonalRecordRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.workout_repository import WorkoutRepository
from db.tables.point_event import PointEvent
from db.tables.workout import Workout
from services.activity_service import ActivityService
from services.bonus_service import BonusService
from services.catalog import Catalog
from services.climb_service import ClimbService
from services.errors import DomainError, StretchingAlreadyLogged, WorkoutEmpty
from services.member import Member
from services.scoring_context import ScoringContextBuilder
from services.scoring_service import score_workout
from services.scoring_types import LineItem, ScoreResult, ScoringRules, WorkoutLog
from services.training_rules import is_completed, performed_at, week_start
from services.workout_mapping import to_workout_log
from services.workout_service import WorkoutService
from services.workout_types import FinishedWorkout


class WorkoutFinisher:
    # The one place that ties finishing together, so it holds every collaborator.
    # pylint: disable=too-many-instance-attributes
    """Turns an in-progress workout into points. Points are only ever computed here."""

    def __init__(
        self,
        workouts: WorkoutService,
        climb: ClimbService,
        workout_rows: WorkoutRepository,
        context: ScoringContextBuilder,
        records: PersonalRecordRepository,
        events: PointEventRepository,
        catalog: Catalog,
        rules: ScoringRules,
        now: Callable[[], datetime],
        activity: ActivityService | None = None,
        bonus: BonusService | None = None,
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._workouts = workouts
        self._climb = climb
        self._rows = workout_rows
        self._context = context
        self._records = records
        self._events = events
        self._catalog = catalog
        self._rules = rules
        self._now = now
        self._activity = activity
        self._bonus = bonus

    async def finish(self, member: Member, workout_id: uuid.UUID) -> FinishedWorkout:
        """Score and close the workout. Needs at least one completed set."""
        workout = await self._workouts.get_in_progress(member, workout_id)
        moment = performed_at(workout.performed_on, member.crew.time_zone, self._now())
        week = await self._context.week(member, moment)
        history = await self._context.history(member, workout, moment)
        log = to_workout_log(workout, self._catalog)
        score = score_workout(log, history, week, self._rules)
        if not score.line_items:
            raise self._nothing_to_pay(log, workout_id)
        before = await self._climb.totals(member)
        await self._close(member, workout, score, moment)
        bonus: list[LineItem] = []
        if self._bonus is not None:
            bonus = await self._bonus.after_workout(member, workout, before)
        after = await self._climb.totals(member)
        finished = FinishedWorkout(
            workout,
            score,
            workouts_this_week=week.workouts_before + (1 if score.completed_sets else 0),
            climb=await self._climb.change(member, before, after),
            bonus_items=tuple(bonus),
        )
        workout.points = finished.total
        await self._rows.save(workout)
        if self._activity is not None:
            await self._activity.workout_finished(member, finished)
        return finished

    @staticmethod
    def _nothing_to_pay(log: WorkoutLog, workout_id: uuid.UUID) -> DomainError:
        stretched = any(
            is_completed(e.exercise, s)
            for e in log.exercises
            if e.exercise.is_stretch
            for s in e.sets
        )
        return (StretchingAlreadyLogged if stretched else WorkoutEmpty)(str(workout_id))

    async def _close(
        self, member: Member, workout: Workout, score: ScoreResult, moment: datetime
    ) -> None:
        """Everything is dated `moment`, when the workout counts as done. The points arrive now."""
        now = self._now()
        this_week = week_start(moment, member.crew.time_zone)
        if workout.performed_on:
            workout.started_at = moment  # How long it took isn't known.
        workout.finished_at = moment
        # Stretching alone pays its points but isn't a workout: nothing that counts workouts,
        # like the weekly goal and streak, sees it.
        workout.week_start = this_week if score.completed_sets else None
        workout.points = score.total
        workout.volume_kg = score.volume_kg
        workout.effort_km = score.effort_km
        await self._rows.save(workout)
        await self._events.add_all(
            [
                PointEvent(
                    user_id=member.user.id,
                    crew_id=member.crew.id,
                    workout_id=workout.id,
                    key=item.key,
                    vars=dict(item.vars),
                    points=item.points,
                    week_start=this_week,
                    created_at=now,
                )
                for item in score.line_items
            ]
        )
        for record in score.records:
            await self._records.store(member.user.id, record, workout.id, moment)
