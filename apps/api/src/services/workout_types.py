"""Data containers for the workout services."""

from dataclasses import dataclass

from db.tables.workout import Workout
from services.climb_types import ClimbChange
from services.scoring_types import LineItem, ScoreResult
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
    """A finished workout with its scored breakdown, week progress and climb."""

    workout: Workout
    score: ScoreResult
    workouts_this_week: int
    climb: ClimbChange
    bonus_items: tuple[LineItem, ...] = ()

    @property
    def total(self) -> int:
        """Workout points plus every bonus it unlocked."""
        return self.score.total + sum(item.points for item in self.bonus_items)

    @property
    def line_items(self) -> tuple[LineItem, ...]:
        """The finish screen: the workout's lines, then the bonuses."""
        return self.score.line_items + self.bonus_items
