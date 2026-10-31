"""Weekly quests: a week's activity → progress per quest (docs/PRODUCT.md → Competition)."""

from services.catalog import load_catalog
from services.quests import WeekActivity, load_quests, quest_progress, week_activity
from services.scoring_types import LoggedExercise, WorkoutLog
from services.training_rules import LoggedSet

CATALOG = load_catalog()


def lift(exercise_id, kg, reps, sets=1):
    exercise = CATALOG.exercise(exercise_id)
    assert exercise is not None
    return LoggedExercise(
        exercise, tuple(LoggedSet(load_kg=kg, reps=reps, done=True) for _ in range(sets))
    )


def cardio(exercise_id, minutes):
    exercise = CATALOG.exercise(exercise_id)
    assert exercise is not None
    return LoggedExercise(exercise, (LoggedSet(minutes=minutes, km=1, done=True),))


def test_quests_are_the_four_from_the_product_spec():
    quests = {q.id: (q.goal, q.bonus) for q in load_quests()}
    assert quests == {"legs2": (2, 150), "ppl": (3, 120), "tonnes": (20, 200), "cardio": (60, 100)}


def test_week_activity_counts_leg_workouts_groups_volume_and_cardio():
    logs = [
        WorkoutLog((lift("squat", 100, 5, sets=2), lift("bench", 60, 5)), "legs"),
        WorkoutLog((lift("row", 70, 8),)),
        WorkoutLog((cardio("run", 25), lift("lunge", 20, 10))),
        WorkoutLog((lift("bench", 60, 5, sets=0),)),  # nothing completed
    ]
    activity = week_activity(logs, bodyweight_kg=80)
    assert activity == WeekActivity(
        leg_workouts=2,
        ppl_groups=frozenset({"legs", "push", "pull"}),
        volume_kg=100 * 5 * 2 + 60 * 5 + 70 * 8 + 20 * 10,
        cardio_minutes=25,
    )


def test_quest_progress_per_metric():
    activity = WeekActivity(
        leg_workouts=1, ppl_groups=frozenset({"push", "pull"}), volume_kg=21_500, cardio_minutes=45
    )
    progress = {q.id: quest_progress(q, activity) for q in load_quests()}
    assert progress == {"legs2": 1, "ppl": 2, "tonnes": 21.5, "cardio": 45}
