"""Data containers for ATUS Climb standings."""

from dataclasses import dataclass
from typing import Literal

from db.tables.user import User

Mode = Literal["all", "week"]


@dataclass(frozen=True, slots=True)
class Standing:
    """One member on the rope."""

    user: User
    points: int
    position: int
    camp: int
    lifetime_points: int
    workouts_this_week: int
    goal_streak: int
    training_now: bool


@dataclass(frozen=True, slots=True)
class Improvement:
    """You vs 4 weeks ago. None where there's no baseline yet."""

    strength_pct: int | None
    volume_pct: int | None
    workouts_change: int


@dataclass(frozen=True, slots=True)
class ClimbView:
    """The whole ATUS Climb tab for one member and mode."""

    mode: Mode
    camp_step: int
    summit: int
    weekly_target: int
    standings: tuple[Standing, ...]
    me: Standing
    next_camp: tuple[int, int] | None
    improvement: Improvement


@dataclass(frozen=True, slots=True)
class ClimbChange:
    """How a finished workout moved the member on the all-time rope."""

    points_before: int
    points_after: int
    camp_before: int
    camp_after: int
    passed: tuple[str, ...]
