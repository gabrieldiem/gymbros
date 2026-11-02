"""Everything a member logged, gathered for a download."""

from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from db.repositories.crew_repository import CrewRepository
from db.repositories.gym_repository import GymRepository
from db.repositories.personal_record_repository import PersonalRecordRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.workout_repository import WorkoutRepository
from db.tables.crew import Crew
from db.tables.gym import Gym
from db.tables.personal_record import PersonalRecord
from db.tables.point_event import PointEvent
from db.tables.user import User
from db.tables.workout import Workout


@dataclass(frozen=True, slots=True)
class ExportedWorkout:
    """A workout and what it paid."""

    workout: Workout
    point_lines: tuple[PointEvent, ...]


@dataclass(frozen=True, slots=True)
class Export:
    """A member's training."""

    exported_at: datetime
    user: User
    crew: Crew | None
    gyms: tuple[Gym, ...]
    records: tuple[PersonalRecord, ...]
    workouts: tuple[ExportedWorkout, ...]


class ExportService:
    """Reads a member's own data, and nobody else's."""

    def __init__(
        self,
        repos: tuple[
            WorkoutRepository,
            PointEventRepository,
            PersonalRecordRepository,
            GymRepository,
            CrewRepository,
        ],
        now: Callable[[], datetime],
    ) -> None:
        self._workouts, self._events, self._records, self._gyms, self._crews = repos
        self._now = now

    async def export(self, user: User) -> Export:
        """Every finished workout, oldest first, with its sets and points."""
        workouts = await self._workouts.finished_by_user(user.id)
        lines: dict = defaultdict(list)
        for event in await self._events.for_workouts([w.id for w in workouts]):
            lines[event.workout_id].append(event)
        return Export(
            exported_at=self._now(),
            user=user,
            crew=await self._crews.get_crew_of(user.id),
            gyms=tuple(await self._gyms.for_user(user.id)),
            records=tuple(await self._records.for_user(user.id)),
            workouts=tuple(ExportedWorkout(w, tuple(lines[w.id])) for w in workouts),
        )
