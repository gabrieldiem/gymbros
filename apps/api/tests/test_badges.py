"""Badges: a member's stats → progress and unlocks, one test per badge in docs/PRODUCT.md."""

from dataclasses import replace
from datetime import UTC, datetime

import pytest

from services.badges import (
    BadgeStats,
    badge_progress,
    is_unlocked,
    load_badges,
    local_hours_and_gaps,
)

NONE = BadgeStats(
    workouts=0,
    better_than_last_time=0,
    best_squat_kg=0,
    lifetime_volume_kg=0,
    longest_goal_streak=0,
    best_bench_kg=0,
    dawn_workouts=0,
    leg_days=0,
    bounties=0,
    crew_quests=0,
    reactions_given=0,
    comments_written=0,
    night_workouts=0,
    comebacks=0,
    total_points=0,
)
BADGES = {b.id: b for b in load_badges()}


def test_there_are_fifteen_badges_with_the_spec_points():
    assert {b.id: b.points for b in load_badges()} == {
        "first": 50, "better": 150, "twoplates": 200, "tonnage": 150, "ironmonth": 150,
        "plateclub": 200, "dawn": 100, "legs": 150, "hunter": 100, "rope": 200,
        "hype": 50, "trash": 50, "owl": 75, "comeback": 100, "unstoppable": 300,
    }  # fmt: skip


@pytest.mark.parametrize(
    ("badge_id", "stats", "unlocked"),
    [
        ("first", {"workouts": 1}, True),
        ("better", {"better_than_last_time": 4}, False),
        ("better", {"better_than_last_time": 5}, True),
        ("twoplates", {"best_squat_kg": 137.5}, False),
        ("twoplates", {"best_squat_kg": 140}, True),
        ("tonnage", {"lifetime_volume_kg": 99_999}, False),
        ("tonnage", {"lifetime_volume_kg": 100_000}, True),
        ("ironmonth", {"longest_goal_streak": 4}, True),
        ("plateclub", {"best_bench_kg": 100}, True),
        ("dawn", {"dawn_workouts": 5}, True),
        ("legs", {"leg_days": 10}, True),
        ("hunter", {"bounties": 1}, True),
        ("rope", {"crew_quests": 3}, True),
        ("hype", {"reactions_given": 50}, True),
        ("trash", {"comments_written": 10}, True),
        ("owl", {"night_workouts": 1}, True),
        ("comeback", {"comebacks": 1}, True),
        ("unstoppable", {"total_points": 8999}, False),
        ("unstoppable", {"total_points": 9000}, True),
    ],
)
def test_each_badge_unlocks_at_its_goal(badge_id, stats, unlocked):
    assert is_unlocked(BADGES[badge_id], replace(NONE, **stats)) is unlocked


def test_progress_is_capped_at_the_goal():
    stats = replace(NONE, lifetime_volume_kg=82_400)
    assert badge_progress(BADGES["tonnage"], stats) == 82.4
    assert badge_progress(BADGES["first"], replace(NONE, workouts=40)) == 1


def test_dawn_night_and_comebacks_are_read_in_crew_time():
    tz = "America/Argentina/Buenos_Aires"  # UTC-3
    finished = [
        datetime(2026, 10, 1, 9, 30, tzinfo=UTC),  # 06:30 local: dawn
        datetime(2026, 10, 2, 1, 30, tzinfo=UTC),  # 22:30 local on the 1st: night
        datetime(2026, 10, 20, 21, 0, tzinfo=UTC),  # 18 days later: comeback
        datetime(2026, 10, 21, 21, 0, tzinfo=UTC),
    ]
    assert local_hours_and_gaps(finished, tz) == (1, 1, 1)
