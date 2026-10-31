"""Conversions between workout rows and the pure scoring inputs."""

from itertools import groupby

from db.tables.workout import Workout
from db.tables.workout_set import WorkoutSet
from services.catalog import Catalog
from services.errors import UnknownExercise
from services.scoring_types import LoggedExercise, WorkoutLog
from services.training_rules import LoggedSet
from services.workout_types import ExerciseEntry


def to_logged_set(row: WorkoutSet) -> LoggedSet:
    """A set row as a scoring input."""
    return LoggedSet(
        load_kg=row.load_kg, reps=row.reps, minutes=row.minutes, km=row.km, done=row.done
    )


def to_entries(workout: Workout) -> tuple[ExerciseEntry, ...]:
    """The workout's sets grouped by exercise, in logger order."""
    return tuple(
        ExerciseEntry(exercise_id=rows[0].exercise_id, sets=tuple(to_logged_set(r) for r in rows))
        for rows in (
            list(group) for _, group in groupby(workout.sets, lambda s: s.exercise_position)
        )
    )


def to_rows(entries: tuple[ExerciseEntry, ...]) -> list[WorkoutSet]:
    """Logger entries as set rows with positions."""
    return [
        WorkoutSet(
            exercise_id=entry.exercise_id,
            exercise_position=exercise_position,
            set_position=set_position,
            load_kg=logged.load_kg,
            reps=logged.reps,
            minutes=logged.minutes,
            km=logged.km,
            done=logged.done,
        )
        for exercise_position, entry in enumerate(entries)
        for set_position, logged in enumerate(entry.sets)
    ]


def to_workout_log(workout: Workout, catalog: Catalog) -> WorkoutLog:
    """The workout as a scoring input."""
    exercises = []
    for entry in to_entries(workout):
        exercise = catalog.exercise(entry.exercise_id)
        if exercise is None:
            raise UnknownExercise(entry.exercise_id)
        exercises.append(LoggedExercise(exercise=exercise, sets=entry.sets))
    return WorkoutLog(exercises=tuple(exercises), routine_id=workout.routine_id)
