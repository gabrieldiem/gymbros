"""ATUS Climb rules: camps, standings order, gaps, goal streak and 'you vs 4 weeks ago'."""

from datetime import date

import pytest

from services.climb_rules import (
    CampScale,
    current_goal_streak,
    next_camp,
    rank_for,
    rank_order,
    strength_change_pct,
    volume_change_pct,
    workouts_change,
)

ALL_TIME = CampScale(step=1500, count=7)
WEEK = CampScale(step=250, count=7)


@pytest.mark.parametrize(
    ("points", "rank"), [(0, 0), (1499, 0), (1500, 1), (3880, 2), (8999, 5), (9000, 6), (25000, 6)]
)
def test_ranks_are_camps_at_1500_point_steps_capped_at_the_summit(points, rank):
    assert rank_for(points, ALL_TIME) == rank


def test_summit_is_the_last_camp():
    assert ALL_TIME.summit == 9000
    assert WEEK.summit == 1500


def test_this_week_mode_scales_the_camps_to_a_1500_point_week():
    assert rank_for(540, WEEK) == 2
    assert rank_for(1500, WEEK) == 6


def test_next_camp_and_points_needed():
    assert next_camp(3880, ALL_TIME) == (3, 620)
    assert next_camp(0, ALL_TIME) == (1, 1500)
    assert next_camp(9000, ALL_TIME) is None


def test_rank_order_is_by_points_then_name():
    entries = [("Santi", 3725), ("Maxo", 4310), ("Ana", 3725), ("Gabi", 3880)]
    assert rank_order(entries, key=lambda e: (e[1], e[0])) == [
        ("Maxo", 4310),
        ("Gabi", 3880),
        ("Ana", 3725),
        ("Santi", 3725),
    ]


def test_current_goal_streak_includes_this_week_once_the_goal_is_hit():
    weeks = {date(2026, 10, 26): 3, date(2026, 10, 19): 3}
    assert current_goal_streak(date(2026, 11, 2), {**weeks, date(2026, 11, 2): 1}, 3) == 2
    assert current_goal_streak(date(2026, 11, 2), {**weeks, date(2026, 11, 2): 3}, 3) == 3


def test_strength_change_is_the_mean_e1rm_change_across_squat_bench_and_deadlift():
    now = {"squat": 110.0, "bench": 105.0, "deadlift": 150.0, "curl": 50.0}
    before = {"squat": 100.0, "bench": 100.0, "deadlift": 150.0, "curl": 10.0}
    assert strength_change_pct(now, before) == 5  # (10 + 5 + 0) / 3


def test_strength_change_ignores_lifts_without_a_baseline():
    assert strength_change_pct({"squat": 110.0, "bench": 100.0}, {"squat": 100.0}) == 10
    assert strength_change_pct({"squat": 110.0}, {}) is None


def test_volume_change_compares_the_last_3_weeks_with_the_3_before():
    this_week = date(2026, 11, 2)
    weeks = {
        date(2026, 10, 26): 12000,
        date(2026, 10, 19): 12000,
        date(2026, 10, 12): 12000,
        date(2026, 10, 5): 10000,
        date(2026, 9, 28): 10000,
        date(2026, 9, 21): 10000,
        this_week: 99999,  # the week in progress is not compared
    }
    assert volume_change_pct(this_week, weeks) == 20
    assert volume_change_pct(this_week, {date(2026, 10, 26): 500}) is None


def test_workouts_change_compares_the_last_4_weeks_with_the_4_before():
    this_week = date(2026, 11, 2)
    counts = {
        this_week: 2,
        date(2026, 10, 26): 3,
        date(2026, 10, 19): 3,
        date(2026, 10, 12): 3,
        date(2026, 10, 5): 2,
        date(2026, 9, 28): 2,
        date(2026, 9, 21): 2,
        date(2026, 9, 14): 2,
    }
    # last 4 (this week included): 2+3+3+3 = 11; the 4 before: 2+2+2+2 = 8
    assert workouts_change(this_week, counts) == 3


def test_longest_goal_streak_finds_the_best_run_ever():
    from services.climb_rules import longest_goal_streak

    weeks = {
        date(2026, 9, 7): 3,
        date(2026, 9, 14): 4,
        date(2026, 9, 21): 1,
        date(2026, 9, 28): 3,
        date(2026, 10, 5): 3,
        date(2026, 10, 12): 3,
    }
    assert longest_goal_streak(weeks, 3) == 3
    assert longest_goal_streak({}, 3) == 0
