"""Data containers for the workout services."""

from dataclasses import dataclass

from db.tables.workout import Workout
from services.scoring_types import ScoreResult
from services.training_rules import LoggedSet


@dataclass(frozen=True, slots=True)
class ExerciseEntry:
    """An exercise in a workout, as sent by the logger: id plus its sets."""

    exercise_id: str
    sets: tuple[LoggedSet, ...]


@dataclass(frozen=True, slots=True)
class ExerciseView:
    """An exercise with its current sets and last time's sets (for the logger)."""

    exercise_id: str
    sets: tuple[LoggedSet, ...]
    previous_sets: tuple[LoggedSet, ...]


@dataclass(frozen=True, slots=True)
class WorkoutView:
    """An in-progress workout with the live points preview."""

    workout: Workout
    exercises: tuple[ExerciseView, ...]
    live: ScoreResult


@dataclass(frozen=True, slots=True)
class FinishedWorkout:
    """A finished workout with its scored breakdown and week progress."""

    workout: Workout
    score: ScoreResult
    workouts_this_week: int
