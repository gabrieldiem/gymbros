"""Pure ATUS Climb rules: camps, order, goal streaks and 'you vs 4 weeks ago'."""

from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, TypeVar

from services.training_rules import goal_streak_before

T = TypeVar("T")
STRENGTH_LIFTS = ("squat", "bench", "deadlift")


@dataclass(frozen=True, slots=True)
class CampScale:
    """Camps every `step` points; the last of `count` camps is the summit."""

    step: int
    count: int

    @property
    def summit(self) -> int:
        """Points at the top camp."""
        return self.step * (self.count - 1)


def rank_for(points: int, scale: CampScale) -> int:
    """The camp index reached with these points (0 = Rookie)."""
    return max(0, min(scale.count - 1, points // scale.step))


def next_camp(points: int, scale: CampScale) -> tuple[int, int] | None:
    """(next camp index, points still needed), or None at the summit."""
    rank = rank_for(points, scale)
    if rank >= scale.count - 1:
        return None
    return rank + 1, (rank + 1) * scale.step - points


def rank_order(entries: Iterable[T], key: Callable[[T], tuple[int, str]]) -> list[T]:
    """Most points first; ties broken by name so the order is stable."""
    return sorted(entries, key=lambda e: (-key(e)[0], key(e)[1].lower()))


def current_goal_streak(this_week: date, workouts_by_week: Mapping[date, int], target: int) -> int:
    """Consecutive goal weeks up to now; this week counts once its goal is hit."""
    before = goal_streak_before(this_week, dict(workouts_by_week), target)
    return before + 1 if workouts_by_week.get(this_week, 0) >= target else before


def strength_change_pct(now: Mapping[str, float], before: Mapping[str, float]) -> int | None:
    """Mean e1RM change (%) across squat, bench and deadlift, over lifts with a baseline."""
    changes = [
        now.get(lift, base) / base - 1
        for lift in STRENGTH_LIFTS
        if (base := before.get(lift)) and lift in now
    ]
    if not changes:
        return None
    return round(sum(changes) / len(changes) * 100)


def _weeks_back(this_week: date, start: int, count: int) -> list[date]:
    return [this_week - timedelta(weeks=start + i) for i in range(count)]


def volume_change_pct(this_week: date, volume_by_week: Mapping[date, float]) -> int | None:
    """Volume of the last 3 finished weeks vs the 3 before, in %."""
    recent = sum(volume_by_week.get(w, 0) for w in _weeks_back(this_week, 1, 3))
    earlier = sum(volume_by_week.get(w, 0) for w in _weeks_back(this_week, 4, 3))
    if not earlier:
        return None
    return round((recent / earlier - 1) * 100)


def workouts_change(this_week: date, workouts_by_week: Mapping[date, Any]) -> int:
    """Workouts in the last 4 weeks (this one included) minus the 4 before."""
    recent = sum(workouts_by_week.get(w, 0) for w in _weeks_back(this_week, 0, 4))
    earlier = sum(workouts_by_week.get(w, 0) for w in _weeks_back(this_week, 4, 4))
    return int(recent - earlier)


def longest_goal_streak(workouts_by_week: Mapping[date, int], target: int) -> int:
    """The longest run of consecutive goal weeks ever."""
    best = run = 0
    previous: date | None = None
    for week in sorted(w for w, count in workouts_by_week.items() if count >= target):
        run = run + 1 if previous and week - previous == timedelta(weeks=1) else 1
        best = max(best, run)
        previous = week
    return best
