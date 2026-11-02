"""Data containers for the backoffice."""

from dataclasses import dataclass
from datetime import datetime

from db.tables.crew import Crew
from db.tables.user import User


@dataclass(frozen=True, slots=True)
class Overview:
    # pylint: disable=too-many-instance-attributes
    """Totals, and activity over the recent window."""

    users: int
    crews: int
    users_without_crew: int
    workouts: int
    recent_workouts: int
    recent_active_users: int
    recent_points: int


@dataclass(frozen=True, slots=True)
class CrewRow:
    """A crew with its member count and all-time points."""

    crew: Crew
    members: int
    points: int


@dataclass(frozen=True, slots=True)
class MemberRow:
    """An account with its crew and totals."""

    user: User
    crew: Crew | None
    points: int
    workouts: int
    last_workout_at: datetime | None
