"""Inputs and outputs of the scoring function. Plain immutable data, no ORM objects."""

from collections.abc import Mapping
from dataclasses import dataclass

from services.catalog import Exercise
from services.training_rules import LoggedSet
from settings import Settings


@dataclass(frozen=True, slots=True)
class LoggedExercise:
    """An exercise in a workout with its sets, in order."""

    exercise: Exercise
    sets: tuple[LoggedSet, ...]


@dataclass(frozen=True, slots=True)
class WorkoutLog:
    """What was logged. `routine_id` is None for an empty workout."""

    exercises: tuple[LoggedExercise, ...]
    routine_id: str | None = None


@dataclass(frozen=True, slots=True)
class History:
    """What came before: best e1RM per exercise, and last session's volume for this routine."""

    personal_records: Mapping[str, float]
    previous_routine_volume_kg: float | None


@dataclass(frozen=True, slots=True)
class WeekState:
    """The member's week before this workout, in crew time."""

    workouts_before: int
    previous_goal_streak: int
    leg_event_active: bool


@dataclass(frozen=True, slots=True)
class ScoringRules:
    # pylint: disable=too-many-instance-attributes
    """Point values and targets (settings.json → scoring.* and game.*)."""

    showed_up: int
    completed_set: int
    leg_event_set_bonus: int
    volume_kg_per_point: int
    cardio_minute: int
    pr: int
    weekly_goal: int
    goal_streak_per_week: int
    goal_streak_max: int
    over_target: int
    better_than_last_time: int
    weekly_target: int
    bodyweight_kg: float

    @classmethod
    def from_settings(cls, settings: Settings) -> "ScoringRules":
        """Build the rules from the loaded settings."""
        return cls(
            showed_up=settings.scoring_showed_up,
            completed_set=settings.scoring_completed_set,
            leg_event_set_bonus=settings.scoring_leg_event_set_bonus,
            volume_kg_per_point=settings.scoring_volume_kg_per_point,
            cardio_minute=settings.scoring_cardio_minute,
            pr=settings.scoring_pr,
            weekly_goal=settings.scoring_weekly_goal,
            goal_streak_per_week=settings.scoring_goal_streak_per_week,
            goal_streak_max=settings.scoring_goal_streak_max,
            over_target=settings.scoring_over_target,
            better_than_last_time=settings.scoring_better_than_last_time,
            weekly_target=settings.game_weekly_target,
            bodyweight_kg=settings.game_bodyweight_kg,
        )


@dataclass(frozen=True, slots=True)
class LineItem:
    """One scoring line: an i18n key, its variables and the points."""

    key: str
    vars: Mapping[str, int | float | str]
    points: int


@dataclass(frozen=True, slots=True)
class RecordSet:
    """The best set of an exercise in this workout that should become its stored PR."""

    exercise_id: str
    load_kg: float
    reps: int
    e1rm: float
    is_improvement: bool


@dataclass(frozen=True, slots=True)
class ScoreResult:
    """The itemized points for a workout plus the numbers shown next to them."""

    line_items: tuple[LineItem, ...]
    total: int
    volume_kg: float
    cardio_minutes: int
    completed_sets: int
    vs_last_pct: int | None
    records: tuple[RecordSet, ...]
