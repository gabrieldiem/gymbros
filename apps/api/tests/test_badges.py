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


def test_there_are_forty_five_badges_with_the_spec_points():
    assert {b.id: b.points for b in load_badges()} == {
        "first": 50, "better": 150, "twoplates": 200, "tonnage": 150, "ironmonth": 150,
        "plateclub": 200, "dawn": 100, "legs": 150, "hunter": 100, "rope": 200,
        "hype": 50, "trash": 50, "owl": 75, "comeback": 100, "unstoppable": 300,
        "tenk": 200, "mile": 200, "longroad": 150,
        "limber": 100, "quarter": 150, "engine": 150, "ironhold": 150,
        # The hard tier: the same metrics, much further.
        "lifer": 400, "improver": 300, "threeplates": 400, "kilotonne": 400, "ironseason": 500,
        "bigbench": 400, "deadlift200": 400, "halfmarathon": 400, "openwater": 400,
        "thousandk": 500, "sunrise": 300, "leglegend": 400, "mostwanted": 400,
        "summitteam": 400, "hypemachine": 200, "commentator": 150, "nightshift": 300,
        "legend": 500, "rubberband": 300, "twomillion": 400, "fightcamp": 400, "statue": 400,
        "lsitminute": 300,
    }  # fmt: skip


def test_twenty_three_badges_are_the_hard_tier():
    assert sum(b.elite for b in load_badges()) == 23


@pytest.mark.parametrize(
    ("badge_id", "field", "below", "at"),
    [
        ("lifer", "workouts", 199, 200),
        ("improver", "better_than_last_time", 49, 50),
        ("threeplates", "best_squat_kg", 177.5, 180),
        ("kilotonne", "lifetime_volume_kg", 999_999, 1_000_000),
        ("ironseason", "longest_goal_streak", 25, 26),
        ("bigbench", "best_bench_kg", 137.5, 140),
        ("deadlift200", "best_deadlift_kg", 197.5, 200),
        ("halfmarathon", "best_run_km", 21, 21.1),
        ("openwater", "best_swim_km", 4.9, 5),
        ("thousandk", "lifetime_effort_km", 999, 1000),
        ("sunrise", "dawn_workouts", 49, 50),
        ("leglegend", "leg_days", 99, 100),
        ("mostwanted", "bounties", 9, 10),
        ("summitteam", "crew_quests", 24, 25),
        ("hypemachine", "reactions_given", 499, 500),
        ("commentator", "comments_written", 99, 100),
        ("nightshift", "night_workouts", 24, 25),
        ("legend", "total_points", 49_999, 50_000),
        ("rubberband", "stretch_sessions", 99, 100),
        ("twomillion", "lifetime_steps", 1_999_999, 2_000_000),
        ("fightcamp", "timed_minutes", 2999, 3000),
        ("statue", "hold_seconds", 10_799, 10_800),
        ("lsitminute", "best_lsit_seconds", 59, 60),
    ],
)
def test_each_hard_badge_unlocks_at_its_goal(badge_id, field, below, at):
    badge = BADGES[badge_id]
    assert badge.elite
    assert not is_unlocked(badge, replace(NONE, **{field: below}))
    assert is_unlocked(badge, replace(NONE, **{field: at}))


@pytest.mark.parametrize(
    ("badge_id", "stats", "unlocked"),
    [
        ("first", {"workouts": 1}, True),
        ("better", {"better_than_last_time": 4}, False),
        ("better", {"better_than_last_time": 5}, True),
        ("twoplates", {"best_squat_kg": 137.5}, False),
        ("twoplates", {"best_squat_kg": 140}, True),
        ("tenk", {"best_run_km": 9.9}, False),
        ("tenk", {"best_run_km": 10}, True),
        ("mile", {"best_swim_km": 1.4}, False),
        ("mile", {"best_swim_km": 1.5}, True),
        ("longroad", {"lifetime_effort_km": 99.9}, False),
        ("longroad", {"lifetime_effort_km": 100}, True),
        ("limber", {"stretch_sessions": 9}, False),
        ("limber", {"stretch_sessions": 10}, True),
        ("quarter", {"lifetime_steps": 249_999}, False),
        ("quarter", {"lifetime_steps": 250_000}, True),
        ("engine", {"timed_minutes": 299}, False),
        ("engine", {"timed_minutes": 300}, True),
        ("ironhold", {"hold_seconds": 1199}, False),
        ("ironhold", {"hold_seconds": 1200}, True),
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
