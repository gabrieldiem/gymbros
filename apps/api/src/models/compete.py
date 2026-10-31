"""Quests, badges, duels, recap and You-tab models."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from models.climb import ClimbResponse
from models.social import ActorModel

DuelMetric = Literal["points", "bench_volume"]
Stake = Literal["stake_shakes", "stake_plates", "stake_playlist", "stake_burritos"]


class QuestModel(BaseModel):
    """A weekly quest and your progress."""

    id: str
    goal: float
    bonus: int
    progress: float
    claimed: bool


class CrewShareModel(BaseModel):
    """One member's share of the crew quest."""

    member: ActorModel
    points: int


class CrewQuestModel(BaseModel):
    """The crew's weekly target."""

    goal: int
    bonus: int
    total: int
    shares: list[CrewShareModel]
    claimed: bool


class BountyModel(BaseModel):
    """The bounty this week: on `target` until someone passes them."""

    target: ActorModel | None
    target_points: int
    points: int
    claimed_by: ActorModel | None


class QuestBoardResponse(BaseModel):
    """The Quests tab (duels and badges have their own endpoints)."""

    week_start: date
    ends_at: datetime
    quests: list[QuestModel]
    crew_quest: CrewQuestModel
    bounty: BountyModel
    weekly_event: str | None
    duel_points: int


class BadgeModel(BaseModel):
    """A badge, your progress and how many in the crew have it."""

    id: str
    goal: float
    points: int
    icon: str
    color: str
    progress: float
    unlocked_at: datetime | None
    crew_count: int


class DuelRequest(BaseModel):
    """Challenge a crew mate."""

    opponent_id: uuid.UUID
    metric: DuelMetric
    stake: Stake


class DuelModel(BaseModel):
    """A duel and where both sides stand."""

    id: uuid.UUID
    status: Literal["pending", "active", "declined", "settled"]
    metric: DuelMetric
    stake: str
    week_start: date
    challenger: ActorModel
    opponent: ActorModel
    challenger_value: float
    opponent_value: float
    winner_id: uuid.UUID | None


class RecapPrModel(BaseModel):
    """A PR set last week."""

    member: ActorModel
    exercise_id: str
    load_kg: float
    reps: int


class RecapResponse(BaseModel):
    """Last week's story slides."""

    week_start: date
    crew_total: int
    biggest_climber: ActorModel | None
    biggest_climber_points: int
    biggest_climber_workouts: int
    heaviest_pr: RecapPrModel | None
    my_points: int
    my_workouts: int
    weekly_target: int
    my_volume_kg: float
    position_before: int
    position_after: int
    my_best_pr: RecapPrModel | None
    most_improved: ActorModel | None
    most_improved_pct: int | None
    bounty_target: ActorModel | None
    weekly_event: str | None


class DayCount(BaseModel):
    """Workouts on a day (crew time)."""

    day: date
    workouts: int


class WeekVolume(BaseModel):
    """Volume lifted in a crew-local week."""

    week_start: date
    volume_kg: float


class PrModel(BaseModel):
    """A personal record."""

    exercise_id: str
    load_kg: float
    reps: int
    e1rm: float
    achieved_at: datetime


class HistoryModel(BaseModel):
    """A recent workout."""

    id: uuid.UUID
    name: str
    finished_at: datetime
    duration_min: int
    points: int
    sets: int
    volume_kg: float


class MeStatsResponse(BaseModel):
    """The You tab."""

    climb: ClimbResponse
    workouts_total: int
    badges_unlocked: int
    heatmap: list[DayCount]
    weekly_volume: list[WeekVolume]
    prs: list[PrModel]
    history: list[HistoryModel]


class LiftPoint(BaseModel):
    """Best e1RM of a lift in a week."""

    week_start: date
    e1rm: float
