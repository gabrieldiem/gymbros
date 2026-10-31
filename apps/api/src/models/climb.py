"""ATUS Climb response models."""

import uuid
from typing import Literal

from pydantic import BaseModel

from models.me import Color


class StandingModel(BaseModel):
    """One member on the rope."""

    user_id: uuid.UUID
    display_name: str
    initials: str
    color: Color
    points: int
    position: int
    camp: int
    workouts_this_week: int
    goal_streak: int
    training_now: bool
    is_me: bool


class NeighbourModel(BaseModel):
    """The member just above or below you, and the points between you."""

    display_name: str
    initials: str
    color: Color
    gap: int
    training_now: bool


class NextCampModel(BaseModel):
    """The next camp and how many points it takes."""

    camp: int
    points_needed: int


class MyStandingModel(BaseModel):
    """Your panel next to the map."""

    position: int
    points: int
    camp: int
    workouts_this_week: int
    goal_streak: int
    above: NeighbourModel | None
    below: NeighbourModel | None
    next_camp: NextCampModel | None


class ImprovementModel(BaseModel):
    """You vs 4 weeks ago. Null where there's no baseline yet."""

    strength_pct: int | None
    volume_pct: int | None
    workouts_change: int


class ClimbResponse(BaseModel):
    """The ATUS Climb tab. Camps are `camp_step` apart; the summit is at `summit` points."""

    mode: Literal["all", "week"]
    camp_step: int
    summit: int
    weekly_target: int
    standings: list[StandingModel]
    me: MyStandingModel
    improvement: ImprovementModel


class ClimbChangeModel(BaseModel):
    """How a finished workout moved you on the all-time rope."""

    points_before: int
    points_after: int
    camp_before: int
    camp_after: int
    passed: list[str]
