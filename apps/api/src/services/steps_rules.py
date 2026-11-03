"""What steps pay. Pure: no database, no clock.

The balance: a 10,000 step day pays 40 points, so a week of them pays about one solid workout.
Steps add to training and never replace it, so they don't count towards the weekly goal, and past
the daily cap more steps pay nothing.
"""

from collections.abc import Callable, Iterable
from datetime import date, timedelta

# Well past a marathon a day: anything more is a typo, not a walk.
MAX_STEPS_PER_DAY = 100_000


def days_in(start: date, end: date) -> tuple[date, ...]:
    """Every day from start to end, both included."""
    return tuple(start + timedelta(days=i) for i in range((end - start).days + 1))


def steps_points(days: int, steps: int, per_point: int, daily_cap: int) -> int:
    """Points for a total over some days. The cap applies to the period, since a total can't say
    how the steps were spread across it."""
    return min(steps, days * daily_cap) // per_point


def points_by_week(days: Iterable[date], points: int, week_of: Callable[[date], date]) -> dict:
    """Points split between the weeks a period touches, by how many of its days each one has.
    Whatever doesn't divide evenly goes to the last, so the total stays exact."""
    per_week: dict[date, int] = {}
    for day in days:
        week = week_of(day)
        per_week[week] = per_week.get(week, 0) + 1
    total_days = sum(per_week.values())
    split = {week: points * count // total_days for week, count in per_week.items()}
    split[max(split)] += points - sum(split.values())
    return {week: value for week, value in split.items() if value > 0}


def steps_per_day(start: date, end: date, steps: int) -> dict[date, int]:
    """A total spread evenly over its days, for anything that counts by day or week."""
    days = days_in(start, end)
    each, extra = divmod(steps, len(days))
    return {day: each + (1 if i < extra else 0) for i, day in enumerate(days)}
