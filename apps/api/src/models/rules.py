"""The public list of what the game pays."""

from pydantic import BaseModel

from models.workouts import LineItemModel
from services.scoring_types import ScoringRules


class RuleQuestModel(BaseModel):
    """A weekly quest and its bonus."""

    id: str
    goal: float
    bonus: int


class RuleBadgeModel(BaseModel):
    """An achievement and what it pays, once."""

    id: str
    goal: float
    points: int
    icon: str
    color: str


class SampleSessionModel(BaseModel):
    """An hour of a sport, scored by the real scoring function."""

    id: str
    minutes: int
    km: float | None
    tonnes: float | None
    total: int
    line_items: list[LineItemModel]


class RulesResponse(BaseModel):
    """Point values come from settings.json, so this list can't drift from what the game pays."""

    points: ScoringRules
    crew_quest: int
    crew_quest_goal: int
    bounty: int
    duel_win: int
    rank_step: int
    rank_count: int
    swim_km_factor: float
    quests: list[RuleQuestModel]
    badges: list[RuleBadgeModel]
    sessions: list[SampleSessionModel]
