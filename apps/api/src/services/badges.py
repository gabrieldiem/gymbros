"""Badges: definitions from resources/badges.json and a typed registry of metrics."""

import json
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import cache
from pathlib import Path
from zoneinfo import ZoneInfo

BADGES_PATH = Path(__file__).resolve().parent.parent / "resources" / "badges.json"
DAWN_BEFORE_HOUR = 7
NIGHT_FROM_HOUR = 22
COMEBACK_GAP = timedelta(days=14)


@dataclass(frozen=True, slots=True)
class BadgeStats:
    # pylint: disable=too-many-instance-attributes
    """Everything the badge metrics read, for one member."""

    workouts: int
    better_than_last_time: int
    best_squat_kg: float
    lifetime_volume_kg: float
    longest_goal_streak: int
    best_bench_kg: float
    dawn_workouts: int
    leg_days: int
    bounties: int
    crew_quests: int
    reactions_given: int
    comments_written: int
    night_workouts: int
    comebacks: int
    total_points: int


@dataclass(frozen=True, slots=True)
class Badge:
    """A one-time achievement worth `points`, unlocked when `metric` reaches `goal`."""

    id: str
    metric: str
    goal: float
    points: int
    icon: str
    color: str


# Open/closed: a new badge is a JSON entry plus, if needed, one metric registered here.
BADGE_METRICS: dict[str, Callable[[BadgeStats], float]] = {
    "workouts": lambda s: s.workouts,
    "better_than_last_time": lambda s: s.better_than_last_time,
    "best_squat_kg": lambda s: s.best_squat_kg,
    "lifetime_tonnes": lambda s: s.lifetime_volume_kg / 1000,
    "longest_goal_streak": lambda s: s.longest_goal_streak,
    "best_bench_kg": lambda s: s.best_bench_kg,
    "dawn_workouts": lambda s: s.dawn_workouts,
    "leg_days": lambda s: s.leg_days,
    "bounties": lambda s: s.bounties,
    "crew_quests": lambda s: s.crew_quests,
    "reactions_given": lambda s: s.reactions_given,
    "comments_written": lambda s: s.comments_written,
    "night_workouts": lambda s: s.night_workouts,
    "comebacks": lambda s: s.comebacks,
    "total_points": lambda s: s.total_points,
}


@cache
def load_badges() -> tuple[Badge, ...]:
    """The badge definitions, validated against the metric registry."""
    raw = json.loads(BADGES_PATH.read_text(encoding="utf-8"))["badges"]
    badges = tuple(Badge(**b) for b in raw)
    unknown = [b.metric for b in badges if b.metric not in BADGE_METRICS]
    if unknown:
        raise ValueError(f"Unknown badge metrics: {unknown}")
    return badges


def badge_progress(badge: Badge, stats: BadgeStats) -> float:
    """Progress towards the goal for display: capped at the goal, one decimal."""
    return round(min(BADGE_METRICS[badge.metric](stats), badge.goal), 1)


def is_unlocked(badge: Badge, stats: BadgeStats) -> bool:
    """Whether the member has reached the badge's goal."""
    return BADGE_METRICS[badge.metric](stats) >= badge.goal


def local_hours_and_gaps(finished: Sequence[datetime], time_zone: str) -> tuple[int, int, int]:
    """(dawn workouts, night workouts, comebacks) from finish times, in crew time."""
    tz = ZoneInfo(time_zone)
    ordered = sorted(finished)
    hours = [moment.astimezone(tz).hour for moment in ordered]
    dawn = sum(1 for h in hours if h < DAWN_BEFORE_HOUR)
    night = sum(1 for h in hours if h >= NIGHT_FROM_HOUR)
    comebacks = sum(1 for a, b in zip(ordered, ordered[1:]) if b - a >= COMEBACK_GAP)
    return dawn, night, comebacks
