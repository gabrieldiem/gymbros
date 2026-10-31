"""Data containers for quests, the crew quest, the bounty and badges."""

from dataclasses import dataclass
from datetime import date, datetime

from db.tables.user import User
from services.badges import Badge
from services.quests import Quest


@dataclass(frozen=True, slots=True)
class QuestView:
    """A weekly quest and the member's progress."""

    quest: Quest
    progress: float
    claimed: bool


@dataclass(frozen=True, slots=True)
class CrewQuestView:
    """The crew's shared weekly target and everyone's share."""

    goal: int
    bonus: int
    total: int
    shares: tuple[tuple[User, int], ...]
    claimed: bool


@dataclass(frozen=True, slots=True)
class BountyView:
    """Who the bounty is on this week (None when claimed or nobody leads), and its value."""

    target: User | None
    target_points: int
    points: int
    claimed_by: User | None


@dataclass(frozen=True, slots=True)
class QuestBoard:
    """The Quests tab, minus duels and badges."""

    week_start: date
    ends_at: datetime
    quests: tuple[QuestView, ...]
    crew_quest: CrewQuestView
    bounty: BountyView
    weekly_event: str | None
    duel_points: int


@dataclass(frozen=True, slots=True)
class BadgeView:
    """A badge with the member's progress and how many in the crew have it."""

    badge: Badge
    progress: float
    unlocked_at: datetime | None
    crew_count: int
