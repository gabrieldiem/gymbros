"""The planned demo history reproduces the prototype's numbers exactly."""

from collections import Counter
from datetime import UTC, datetime

import pytest

from services.catalog import load_catalog
from services.climb_rules import current_goal_streak
from services.demo_history import (
    MemberStats,
    past_weeks_layout,
    plan_history,
    split_points,
)
from services.training_rules import week_start

TZ = "America/Argentina/Buenos_Aires"
PROTOTYPE = {
    "gabi": MemberStats(3880, 540, 3, 64, 2),
    "maxo": MemberStats(4310, 620, 12, 88, 3),
    "santi": MemberStats(3725, 705, 6, 79, 3),
    "jose": MemberStats(2950, 310, 2, 51, 2),
    "matex": MemberStats(2210, 480, 1, 40, 1),
}


def test_split_points_adds_up():
    assert split_points(10, 3) == [4, 3, 3]
    assert split_points(0, 2) == [0, 0]
    assert split_points(5, 0) == []


def test_past_weeks_layout_has_the_streak_then_a_break():
    assert past_weeks_layout(14, 3, 3) == [3, 3, 3, 2, 2, 1]
    with pytest.raises(ValueError):
        past_weeks_layout(2, 3, 3)


@pytest.mark.parametrize("key", list(PROTOTYPE))
@pytest.mark.parametrize(
    "now",
    [datetime(2026, 11, 5, 21, 0, tzinfo=UTC), datetime(2026, 11, 2, 3, 5, tzinfo=UTC)],
    ids=["thursday", "monday-just-after-midnight"],
)
def test_plan_matches_the_prototype_numbers(key, now):
    stats = PROTOTYPE[key]
    plan = plan_history(stats, ["push", "pull", "legs"], 1.0, load_catalog(), now, TZ, 3)
    this_week = week_start(now, TZ)
    weeks = Counter(week_start(p.finished_at, TZ) for p in plan)

    assert len(plan) == stats.sessions
    assert sum(p.points for p in plan) == stats.all_points
    assert (
        sum(p.points for p in plan if week_start(p.finished_at, TZ) == this_week)
        == stats.week_points
    )
    assert weeks[this_week] == stats.workouts_this_week
    assert current_goal_streak(this_week, weeks, 3) == stats.goal_streak
    assert all(p.finished_at < now for p in plan)
    assert [p.finished_at for p in plan] == sorted(p.finished_at for p in plan)


def test_loads_progress_over_time():
    plan = plan_history(
        PROTOTYPE["gabi"], ["push"], 1.0, load_catalog(), datetime(2026, 11, 5, tzinfo=UTC), TZ, 3
    )
    first_bench = plan[0].exercises[0][1][0].load_kg
    last_bench = plan[-1].exercises[0][1][0].load_kg
    assert first_bench is not None and last_bench is not None
    assert last_bench > first_bench
    assert last_bench % 2.5 == 0
