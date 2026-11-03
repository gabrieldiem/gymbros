"""The You tab: lifetime stats, heatmap, weekly tonnage, PRs (with history) and recent workouts."""

import uuid
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from db.repositories.badge_repository import BadgeRepository
from db.repositories.personal_record_repository import PersonalRecordRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.workout_repository import WorkoutRepository
from db.repositories.workout_stats_repository import WorkoutStatsRepository
from db.tables.personal_record import PersonalRecord
from db.tables.point_event import PointEvent
from db.tables.workout import Workout
from services.catalog import Catalog
from services.climb_service import ClimbService
from services.climb_types import ClimbView
from services.errors import UnknownExerciseForHistory, WorkoutNotFound
from services.member import Member
from services.training_rules import estimated_1rm, is_completed, week_start
from services.workout_mapping import to_entries, to_workout_log
from services.workout_types import ExerciseEntry

HEATMAP_DAYS = 84
TONNAGE_WEEKS = 8
PR_HISTORY_WEEKS = 26
HISTORY_SIZE = 20


@dataclass(frozen=True, slots=True)
class HistoryEntry:
    """A recent workout in the profile history."""

    workout: Workout
    sets: int


@dataclass(frozen=True, slots=True)
class MeStats:
    # pylint: disable=too-many-instance-attributes
    """Everything on the You tab."""

    climb: ClimbView
    workouts_total: int
    badges_unlocked: int
    heatmap: tuple[tuple[date, int], ...]
    weekly_volume: tuple[tuple[date, float], ...]
    records: tuple[PersonalRecord, ...]
    history: tuple[HistoryEntry, ...]


@dataclass(frozen=True, slots=True)
class WorkoutDetail:
    """One finished workout: what was completed and what it paid."""

    workout: Workout
    sets: int
    exercises: tuple[ExerciseEntry, ...]
    line_items: tuple[PointEvent, ...]
    # Until when you can change it. None: you can't any more.
    editable_until: datetime | None = None


class MeStatsService:
    """Builds the You tab and per-lift PR history."""

    def __init__(
        self,
        climb: ClimbService,
        repos: tuple[
            WorkoutRepository, WorkoutStatsRepository, PersonalRecordRepository, BadgeRepository
        ],
        catalog: Catalog,
        now: Callable[[], datetime],
        events: PointEventRepository,
        edit_window: timedelta,
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._events = events
        self._edit_window = edit_window
        self._climb = climb
        self._workouts, self._stats, self._records, self._badges = repos
        self._catalog = catalog
        self._now = now

    async def workout_detail(self, member: Member, workout_id: uuid.UUID) -> WorkoutDetail:
        """One of the member's own finished workouts."""
        workout = await self._workouts.get(workout_id)
        if workout is None or workout.user_id != member.user.id or workout.finished_at is None:
            raise WorkoutNotFound(str(workout_id))
        log = to_workout_log(workout, self._catalog)
        exercises = tuple(
            ExerciseEntry(
                logged.exercise.id,
                tuple(s for s in logged.sets if is_completed(logged.exercise, s)),
                entry.custom_name,
            )
            for logged, entry in zip(log.exercises, to_entries(workout))
        )
        done = tuple(entry for entry in exercises if entry.sets)
        paid = tuple(await self._events.for_workout(workout.id))
        return WorkoutDetail(
            workout=workout,
            sets=sum(len(entry.sets) for entry in done),
            exercises=done,
            line_items=paid,
            editable_until=self._editable_until(paid),
        )

    def _editable_until(self, paid: tuple[PointEvent, ...]) -> datetime | None:
        logged_at = min((event.created_at for event in paid), default=None)
        if logged_at is None or self._now() > logged_at + self._edit_window:
            return None
        return logged_at + self._edit_window

    async def stats(self, member: Member) -> MeStats:
        """The member's profile."""
        now = self._now()
        times = await self._stats.finished_times(member.user.id)
        recent = await self._stats.recent_finished(member.user.id, HISTORY_SIZE)
        sets = await self._stats.completed_set_counts([w.id for w in recent])
        return MeStats(
            climb=await self._climb.view(member, "all", now),
            workouts_total=len(times),
            badges_unlocked=len(await self._badges.unlocked(member.user.id)),
            heatmap=self._heatmap(times, member.crew.time_zone, now),
            weekly_volume=await self._weekly_volume(member, now),
            records=tuple(await self._records.for_user(member.user.id)),
            history=tuple(HistoryEntry(w, sets.get(w.id, 0)) for w in recent),
        )

    async def lift_history(
        self, member: Member, exercise_id: str
    ) -> tuple[tuple[date, float], ...]:
        """Best e1RM per week for a lift over the last half year."""
        exercise = self._catalog.exercise(exercise_id)
        if exercise is None or exercise.is_cardio:
            raise UnknownExerciseForHistory(exercise_id)
        since = week_start(self._now(), member.crew.time_zone) - timedelta(weeks=PR_HISTORY_WEEKS)
        best: dict[date, float] = {}
        for week, load, reps in await self._stats.lift_sets_by_week(
            member.user.id, exercise_id, since
        ):
            best[week] = max(best.get(week, 0.0), round(estimated_1rm(load, reps), 1))
        return tuple(sorted(best.items()))

    @staticmethod
    def _heatmap(
        times: list[datetime], time_zone: str, now: datetime
    ) -> tuple[tuple[date, int], ...]:
        tz = ZoneInfo(time_zone)
        today = now.astimezone(tz).date()
        start = today - timedelta(days=HEATMAP_DAYS - 1)
        days = Counter(t.astimezone(tz).date() for t in times)
        return tuple(
            (start + timedelta(days=i), days.get(start + timedelta(days=i), 0))
            for i in range(HEATMAP_DAYS)
        )

    async def _weekly_volume(self, member: Member, now: datetime) -> tuple[tuple[date, float], ...]:
        this_week = week_start(now, member.crew.time_zone)
        weeks = [this_week - timedelta(weeks=TONNAGE_WEEKS - 1 - i) for i in range(TONNAGE_WEEKS)]
        volume = await self._workouts.volume_by_week(member.user.id, weeks[0])
        return tuple((w, round(volume.get(w, 0.0), 1)) for w in weeks)
