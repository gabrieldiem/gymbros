"""One test per scoring rule in docs/PRODUCT.md (rules computed when a workout is finished).

Quest, crew quest, bounty and badge points are paid by their own evaluators (Phase 5).
"""

from dataclasses import replace

import pytest

from services.catalog import load_catalog
from services.scoring_service import (
    History,
    LoggedExercise,
    LoggedSet,
    ScoringRules,
    WeekState,
    WorkoutLog,
    score_workout,
)

CATALOG = load_catalog()
RULES = ScoringRules(
    showed_up=50,
    completed_set=5,
    leg_event_set_bonus=5,
    volume_kg_per_point=100,
    cardio_minute=2,
    cardio_effort_km=8,
    pr=100,
    weekly_goal=150,
    goal_streak_per_week=20,
    goal_streak_max=100,
    over_target=50,
    better_than_last_time=25,
    stretching=25,
    weekly_target=3,
    bodyweight_kg=80,
)
NO_HISTORY = History(personal_records={}, previous_routine_volume_kg=None)
FIRST_OF_WEEK = WeekState(workouts_before=0, previous_goal_streak=0, leg_event_active=False)


def lift(exercise_id: str, *sets: tuple[float, int], done: bool = True) -> LoggedExercise:
    exercise = CATALOG.exercise(exercise_id)
    assert exercise is not None
    return LoggedExercise(
        exercise=exercise,
        sets=tuple(LoggedSet(load_kg=kg, reps=reps, done=done) for kg, reps in sets),
    )


def cardio(exercise_id: str, *minutes: int) -> LoggedExercise:
    exercise = CATALOG.exercise(exercise_id)
    assert exercise is not None
    return LoggedExercise(
        exercise=exercise,
        sets=tuple(LoggedSet(minutes=m, km=1.0, done=True) for m in minutes),
    )


def workout(*exercises: LoggedExercise, routine_id: str | None = None) -> WorkoutLog:
    return WorkoutLog(exercises=tuple(exercises), routine_id=routine_id)


def score(log, history=NO_HISTORY, week=FIRST_OF_WEEK, rules=RULES):
    return score_workout(log, history, week, rules)


def items(result) -> dict[str, tuple[dict, int]]:
    return {item.key: (dict(item.vars), item.points) for item in result.line_items}


# --- Showed up ----------------------------------------------------------------------------


def test_showed_up_pays_50_for_a_workout_with_a_completed_set():
    result = score(workout(lift("curl", (30, 10))))
    assert items(result)["ln_show"] == ({}, 50)


def test_showed_up_pays_nothing_without_a_completed_set():
    result = score(workout(lift("curl", (30, 10), done=False)))
    assert result.line_items == ()
    assert result.total == 0


# --- Completed set ------------------------------------------------------------------------


def test_completed_set_pays_5_each():
    result = score(workout(lift("curl", (30, 10), (30, 10), (30, 8))))
    assert items(result)["ln_sets"] == ({"n": 3}, 15)


def test_completed_set_ignores_unchecked_and_zero_rep_sets():
    exercise = lift("curl", (30, 10))
    with_extra = replace(
        exercise,
        sets=exercise.sets
        + (LoggedSet(load_kg=30, reps=10, done=False), LoggedSet(load_kg=30, reps=0, done=True)),
    )
    assert items(score(workout(with_extra)))["ln_sets"] == ({"n": 1}, 5)


def test_completed_set_counts_a_cardio_entry_as_one_set():
    result = score(workout(cardio("run", 20)))
    assert items(result)["ln_sets"] == ({"n": 1}, 5)


# --- Leg day x2 event ---------------------------------------------------------------------


def test_leg_day_x2_pays_5_per_leg_set_while_the_event_is_active():
    week = replace(FIRST_OF_WEEK, leg_event_active=True)
    result = score(workout(lift("squat", (100, 5), (100, 5)), lift("bench", (60, 5))), week=week)
    assert items(result)["ln_leg_event"] == ({"n": 2}, 10)


def test_leg_day_x2_pays_nothing_when_the_event_is_off():
    result = score(workout(lift("squat", (100, 5))))
    assert "ln_leg_event" not in items(result)


# --- Volume -------------------------------------------------------------------------------


def test_volume_pays_1_per_100_kg():
    result = score(workout(lift("squat", (100, 5), (100, 5), (95, 5))))  # 1475 kg
    assert items(result)["ln_vol"] == ({"kg": 1475}, 14)
    assert result.volume_kg == 1475


def test_volume_counts_bodyweight_as_80_kg_plus_added_load():
    result = score(workout(lift("pullup", (0, 10), (10, 5))))  # 80×10 + 90×5 = 1250
    assert result.volume_kg == 1250
    assert items(result)["ln_vol"][1] == 12


def test_volume_under_100_kg_pays_nothing():
    result = score(workout(lift("lateral", (8, 10))))  # 80 kg
    assert "ln_vol" not in items(result)


def test_volume_bodyweight_comes_from_the_rules():
    result = score(workout(lift("pullup", (0, 10))), rules=replace(RULES, bodyweight_kg=70))
    assert result.volume_kg == 700


# --- Cardio -------------------------------------------------------------------------------


def session(exercise_id: str, minutes: int, km: float | None) -> LoggedExercise:
    exercise = CATALOG.exercise(exercise_id)
    assert exercise is not None
    return LoggedExercise(exercise=exercise, sets=(LoggedSet(minutes=minutes, km=km, done=True),))


def test_cardio_pays_2_per_minute():
    result = score(workout(cardio("run", 20), cardio("rower", 10)))
    assert items(result)["ln_cardio"] == ({"minutes": 30}, 60)
    assert result.volume_kg == 0


def test_cardio_distance_pays_8_per_run_equivalent_km():
    assert items(score(workout(session("outrun", 30, 5))))["ln_distance"] == ({"km": 5}, 40)


def test_a_swim_km_counts_as_4_run_km():
    result = score(workout(session("swim", 30, 1.25)))
    assert items(result)["ln_distance"] == ({"km": 1.25}, 40)
    assert result.effort_km == 5


def test_cardio_without_a_distance_pays_only_time():
    assert "ln_distance" not in items(score(workout(session("outrun", 30, None))))


def test_going_further_in_the_same_time_pays_more():
    assert (
        score(workout(session("outrun", 40, 8))).total
        > score(workout(session("outrun", 40, 4))).total
    )


def test_an_impossible_distance_is_capped_at_20_kmh():
    capped = score(workout(session("outrun", 30, 500)))
    assert capped.effort_km == 10
    assert items(capped)["ln_distance"][1] == 80


@pytest.mark.parametrize(
    "exercises",
    [
        # 60 minutes of each sport, at an ordinary pace for someone training regularly.
        (session("outrun", 60, 10),),
        (session("swim", 60, 2.5),),
        (session("rower", 60, 12.5),),
    ],
)
def test_an_hour_of_cardio_pays_about_the_same_as_an_hour_of_lifting(exercises):
    # 16 sets of 750 kg: a 12 tonne session, like the seeded Leg days.
    lifting = score(workout(lift("squat", *[(75, 10)] * 16))).total
    cardio_total = score(workout(*exercises)).total
    assert abs(cardio_total - lifting) / lifting <= 0.1
    assert lifting == 250


def test_half_an_hour_of_each_sport_also_pays_about_the_same():
    lifting = score(workout(lift("squat", *[(75, 10)] * 8))).total
    running = score(workout(session("outrun", 30, 5))).total
    swimming = score(workout(session("swim", 30, 1.25))).total
    assert running == swimming
    assert abs(running - lifting) / lifting <= 0.1


# --- Endurance PRs and better than last time ------------------------------------------------


def test_a_first_cardio_log_only_sets_the_baseline():
    result = score(workout(session("outrun", 30, 5)))
    assert "ln_pr_distance" not in items(result)
    assert [r.exercise_id for r in result.records] == ["outrun"]
    assert result.records[0].load_kg == 5
    assert result.records[0].reps == 30


def test_running_the_same_distance_faster_is_a_pr():
    baseline = score(workout(session("outrun", 30, 5))).records[0].e1rm
    history = replace(NO_HISTORY, personal_records={"outrun": baseline})
    result = score(workout(session("outrun", 28, 5)), history=history)
    assert items(result)["ln_pr_distance"] == (
        {"exercise_id": "outrun", "km": 5, "minutes": 28},
        100,
    )


def test_going_further_at_the_same_pace_is_a_pr():
    baseline = score(workout(session("swim", 30, 1))).records[0].e1rm
    history = replace(NO_HISTORY, personal_records={"swim": baseline})
    assert "ln_pr_distance" in items(score(workout(session("swim", 60, 2)), history=history))


def test_slower_over_the_same_distance_is_not_a_pr():
    baseline = score(workout(session("outrun", 30, 5))).records[0].e1rm
    history = replace(NO_HISTORY, personal_records={"outrun": baseline})
    assert "ln_pr_distance" not in items(score(workout(session("outrun", 35, 5)), history=history))


def test_a_very_short_effort_never_sets_a_pr():
    assert score(workout(session("swim", 5, 0.2))).records == ()


def test_cardio_without_a_distance_never_sets_a_pr():
    assert score(workout(session("outrun", 30, None))).records == ()


def test_better_than_last_time_counts_distance():
    history = replace(NO_HISTORY, previous_routine_effort_km=5.0)
    result = score(workout(session("outrun", 40, 6), routine_id="run"), history=history)
    assert result.vs_last_pct == 20
    assert items(result)["ln_better"] == ({"pct": 20}, 25)


def test_cardio_without_a_distance_has_no_comparison():
    history = replace(NO_HISTORY, previous_routine_effort_km=5.0)
    assert (
        score(workout(session("outrun", 40, None), routine_id="run"), history=history).vs_last_pct
        is None
    )


# --- PR -----------------------------------------------------------------------------------


def test_pr_pays_100_when_the_best_e1rm_beats_the_stored_pr():
    history = replace(NO_HISTORY, personal_records={"bench": 100 * (1 + 5 / 30)})
    result = score(workout(lift("bench", (100, 5), (102.5, 5), (95, 6))), history=history)
    assert items(result)["ln_pr"] == ({"exercise_id": "bench", "load_kg": 102.5, "reps": 5}, 100)
    assert [r.exercise_id for r in result.records] == ["bench"]


def test_pr_must_beat_not_match_the_stored_pr():
    history = replace(NO_HISTORY, personal_records={"bench": 100 * (1 + 5 / 30)})
    result = score(workout(lift("bench", (100, 5))), history=history)
    assert "ln_pr" not in items(result)
    assert result.records == ()


def test_pr_pays_once_per_exercise():
    history = replace(NO_HISTORY, personal_records={"bench": 50.0, "squat": 50.0})
    result = score(
        workout(lift("bench", (60, 5), (70, 5)), lift("squat", (80, 5))), history=history
    )
    prs = [item for item in result.line_items if item.key == "ln_pr"]
    assert [(p.vars["exercise_id"], p.points) for p in prs] == [("bench", 100), ("squat", 100)]


def test_pr_first_log_of_an_exercise_sets_a_baseline_without_points():
    result = score(workout(lift("bench", (60, 5))))
    assert "ln_pr" not in items(result)
    assert [(r.exercise_id, r.load_kg, r.reps, r.is_improvement) for r in result.records] == [
        ("bench", 60, 5, False)
    ]


def test_pr_uses_bodyweight_load_for_bodyweight_exercises():
    history = replace(NO_HISTORY, personal_records={"pullup": 80 * (1 + 10 / 30)})
    result = score(workout(lift("pullup", (5, 10))), history=history)
    assert items(result)["ln_pr"][0] == {"exercise_id": "pullup", "load_kg": 5, "reps": 10}


def test_a_cardio_pr_is_not_a_lift_pr():
    history = replace(NO_HISTORY, personal_records={"outrun": 1.0})
    result = items(score(workout(session("outrun", 30, 5)), history=history))
    assert "ln_pr" not in result
    assert "ln_pr_distance" in result


# --- Weekly goal, goal streak, over target -----------------------------------------------


def test_weekly_goal_hit_pays_150_on_the_third_workout_of_the_week():
    week = replace(FIRST_OF_WEEK, workouts_before=2)
    assert items(score(workout(lift("curl", (30, 10))), week=week))["ln_goal"] == ({"n": 3}, 150)


def test_weekly_goal_pays_nothing_before_the_third_workout():
    week = replace(FIRST_OF_WEEK, workouts_before=1)
    result = items(score(workout(lift("curl", (30, 10))), week=week))
    assert "ln_goal" not in result
    assert "ln_streak" not in result


def test_goal_streak_pays_20_per_week_with_the_weekly_goal():
    week = WeekState(workouts_before=2, previous_goal_streak=2, leg_event_active=False)
    assert items(score(workout(lift("curl", (30, 10))), week=week))["ln_streak"] == (
        {"weeks": 3},
        60,
    )


def test_goal_streak_is_capped_at_100():
    week = WeekState(workouts_before=2, previous_goal_streak=9, leg_event_active=False)
    assert items(score(workout(lift("curl", (30, 10))), week=week))["ln_streak"] == (
        {"weeks": 10},
        100,
    )


def test_goal_streak_of_one_week_pays_20():
    week = replace(FIRST_OF_WEEK, workouts_before=2)
    assert items(score(workout(lift("curl", (30, 10))), week=week))["ln_streak"] == (
        {"weeks": 1},
        20,
    )


@pytest.mark.parametrize(("before", "n"), [(3, 4), (4, 5)])
def test_over_target_pays_50_for_each_workout_after_the_third(before, n):
    week = replace(FIRST_OF_WEEK, workouts_before=before)
    result = items(score(workout(lift("curl", (30, 10))), week=week))
    assert result["ln_over"] == ({"n": n}, 50)
    assert "ln_goal" not in result


def test_weekly_target_comes_from_the_rules():
    week = replace(FIRST_OF_WEEK, workouts_before=3)
    result = items(
        score(workout(lift("curl", (30, 10))), week=week, rules=replace(RULES, weekly_target=4))
    )
    assert result["ln_goal"] == ({"n": 4}, 150)


# --- Better than last time ----------------------------------------------------------------


def test_better_than_last_time_pays_25_when_volume_beats_the_previous_session_of_the_routine():
    history = replace(NO_HISTORY, previous_routine_volume_kg=1000)
    result = score(workout(lift("squat", (100, 11)), routine_id="legs"), history=history)
    assert items(result)["ln_better"] == ({"pct": 10}, 25)
    assert result.vs_last_pct == 10


def test_better_than_last_time_pays_nothing_when_volume_is_lower():
    history = replace(NO_HISTORY, previous_routine_volume_kg=1000)
    result = score(workout(lift("squat", (100, 9)), routine_id="legs"), history=history)
    assert "ln_better" not in items(result)
    assert result.vs_last_pct == -10


def test_better_than_last_time_needs_a_previous_session():
    result = score(workout(lift("squat", (100, 9)), routine_id="legs"))
    assert "ln_better" not in items(result)
    assert result.vs_last_pct is None


# --- The whole breakdown ------------------------------------------------------------------


def test_line_items_are_keys_and_vars_in_a_stable_order_and_total_is_their_sum():
    history = History(personal_records={"squat": 100.0}, previous_routine_volume_kg=500)
    week = WeekState(workouts_before=2, previous_goal_streak=1, leg_event_active=True)
    result = score(workout(lift("squat", (100, 5), (100, 5)), routine_id="legs"), history, week)
    assert [item.key for item in result.line_items] == [
        "ln_show",
        "ln_sets",
        "ln_leg_event",
        "ln_vol",
        "ln_pr",
        "ln_goal",
        "ln_streak",
        "ln_better",
    ]
    assert result.total == sum(item.points for item in result.line_items)
    assert result.total == 50 + 10 + 10 + 10 + 100 + 150 + 40 + 25


def test_point_values_come_from_the_rules_not_the_code():
    doubled = replace(RULES, showed_up=100, completed_set=10)
    result = items(score(workout(lift("curl", (30, 10))), rules=doubled))
    assert result["ln_show"][1] == 100
    assert result["ln_sets"][1] == 10


# --- Stretching ----------------------------------------------------------------------------


def stretching(minutes: int = 5, done: bool = True) -> LoggedExercise:
    exercise = CATALOG.exercise("stretch")
    assert exercise is not None
    return LoggedExercise(exercise=exercise, sets=(LoggedSet(minutes=minutes, done=done),))


BENCH = lift("bench", (60, 5))


def test_stretching_pays_fixed_points_whatever_the_minutes():
    for minutes in (5, 10, 60):
        result = score(workout(stretching(minutes), BENCH))
        assert items(result)["ln_stretch"] == ({}, RULES.stretching)


def test_stretching_isnt_a_set_or_cardio():
    result = score(workout(stretching(10), BENCH))
    assert result.completed_sets == 1
    assert result.cardio_minutes == 0
    assert "ln_cardio" not in items(result)


def test_stretching_alone_pays_only_the_fixed_points():
    result = score(workout(stretching(10)))
    assert [item.key for item in result.line_items] == ["ln_stretch"]
    assert result.total == RULES.stretching
    assert result.completed_sets == 0


def test_stretching_alone_doesnt_pay_the_weekly_goal():
    week = WeekState(workouts_before=2, previous_goal_streak=3, leg_event_active=False)
    result = score(workout(stretching()), week=week)
    assert [item.key for item in result.line_items] == ["ln_stretch"]


def test_an_unchecked_stretch_pays_nothing():
    assert score(workout(stretching(done=False))).total == 0


def test_stretching_pays_once_a_day():
    history = replace(NO_HISTORY, stretched_that_day=True)
    assert score(workout(stretching()), history).total == 0
    mixed = score(workout(stretching(), BENCH), history)
    assert "ln_stretch" not in items(mixed)
    assert "ln_show" in items(mixed)
