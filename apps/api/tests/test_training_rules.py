"""e1RM, bodyweight load, progressive overload, crew-local weeks and goal streaks."""

from datetime import UTC, date, datetime

import pytest

from services.catalog import load_catalog
from services.training_rules import (
    LoggedSet,
    effective_load,
    estimated_1rm,
    goal_streak_before,
    is_completed,
    overload,
    week_start,
)

CATALOG = load_catalog()


def ex(exercise_id: str):
    exercise = CATALOG.exercise(exercise_id)
    assert exercise is not None
    return exercise


def test_e1rm_uses_epley():
    assert estimated_1rm(100, 5) == pytest.approx(116.6667, rel=1e-4)
    assert estimated_1rm(100, 0) == 100


def test_effective_load_adds_bodyweight_for_bodyweight_exercises():
    assert effective_load(ex("pullup"), 10, 80) == 90
    assert effective_load(ex("pullup"), None, 80) == 80
    assert effective_load(ex("bench"), 60, 80) == 60


def test_is_completed_needs_done_and_reps_or_minutes():
    assert is_completed(ex("bench"), LoggedSet(load_kg=60, reps=5, done=True))
    assert not is_completed(ex("bench"), LoggedSet(load_kg=60, reps=5, done=False))
    assert not is_completed(ex("bench"), LoggedSet(load_kg=60, reps=0, done=True))
    assert is_completed(ex("run"), LoggedSet(minutes=20, done=True))
    assert not is_completed(ex("run"), LoggedSet(minutes=0, km=2, done=True))


def test_overload_adds_2_5_kg_to_barbell_lifts():
    assert overload(ex("bench"), LoggedSet(load_kg=90, reps=5, done=True)) == LoggedSet(
        load_kg=92.5, reps=5
    )


def test_overload_adds_a_rep_to_other_weighted_and_bodyweight_lifts():
    assert overload(ex("incline"), LoggedSet(load_kg=30, reps=10, done=True)) == LoggedSet(
        load_kg=30, reps=11
    )
    assert overload(ex("pullup"), LoggedSet(load_kg=0, reps=10, done=True)) == LoggedSet(
        load_kg=0, reps=11
    )


def test_overload_adds_a_minute_to_cardio():
    assert overload(ex("run"), LoggedSet(minutes=25, km=4.2, done=True)) == LoggedSet(
        minutes=26, km=4.2
    )


def test_week_starts_monday_in_crew_time():
    # Monday 04:30 UTC is Monday 01:30 in Buenos Aires (UTC-3).
    monday_ba = datetime(2026, 11, 2, 4, 30, tzinfo=UTC)
    assert week_start(monday_ba, "America/Argentina/Buenos_Aires") == date(2026, 11, 2)
    # Monday 02:00 UTC is still Sunday 23:00 in Buenos Aires: last week.
    sunday_night_ba = datetime(2026, 11, 2, 2, 0, tzinfo=UTC)
    assert week_start(sunday_night_ba, "America/Argentina/Buenos_Aires") == date(2026, 10, 26)
    assert week_start(sunday_night_ba, "UTC") == date(2026, 11, 2)


def test_goal_streak_counts_consecutive_goal_weeks_before_this_one():
    this_week = date(2026, 11, 2)
    counts = {
        date(2026, 10, 26): 3,
        date(2026, 10, 19): 4,
        date(2026, 10, 12): 2,
        date(2026, 10, 5): 3,
    }
    assert goal_streak_before(this_week, counts, 3) == 2
    assert goal_streak_before(this_week, {}, 3) == 0
    assert goal_streak_before(this_week, {this_week: 5}, 3) == 0
