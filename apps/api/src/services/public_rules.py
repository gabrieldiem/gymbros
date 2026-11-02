"""What the game pays, for the public landing page. The server is the only source of these numbers,
including the three sample sessions, which go through the real scoring function."""

from dataclasses import dataclass

from services.badges import Badge, load_badges
from services.catalog import Catalog
from services.quests import Quest, load_quests
from services.scoring_service import History, WeekState, WorkoutLog, score_workout
from services.scoring_types import LoggedExercise, ScoreResult, ScoringRules
from services.training_rules import LoggedSet

SESSION_MINUTES = 60
_LIFT_SETS = 16
_LIFT_KG = 75
_LIFT_REPS = 10
_NO_HISTORY = History(personal_records={}, previous_routine_volume_kg=None)
_FIRST_OF_WEEK = WeekState(workouts_before=0, previous_goal_streak=0, leg_event_active=False)


@dataclass(frozen=True, slots=True)
class SampleSession:
    """One hour of a sport at an ordinary pace, and what the real scoring pays for it."""

    id: str
    minutes: int
    km: float | None
    tonnes: float | None
    score: ScoreResult


@dataclass(frozen=True, slots=True)
class PublicRules:
    """Point values, targets, quests, badges and sample sessions."""

    points: ScoringRules
    rank_step: int
    rank_count: int
    swim_km_factor: float
    quests: tuple[Quest, ...]
    badges: tuple[Badge, ...]
    sessions: tuple[SampleSession, ...]


def _score(catalog: Catalog, rules: ScoringRules, exercise_id: str, sets: tuple) -> ScoreResult:
    exercise = catalog.exercise(exercise_id)
    if exercise is None:
        raise ValueError(f"Unknown exercise in a sample session: {exercise_id}")
    log = WorkoutLog((LoggedExercise(exercise, sets),))
    return score_workout(log, _NO_HISTORY, _FIRST_OF_WEEK, rules)


def _cardio(catalog: Catalog, rules: ScoringRules, sport: str, exercise_id: str, km: float):
    logged = (LoggedSet(minutes=SESSION_MINUTES, km=km, done=True),)
    return SampleSession(
        sport, SESSION_MINUTES, km, None, _score(catalog, rules, exercise_id, logged)
    )


def _sample_sessions(catalog: Catalog, rules: ScoringRules) -> tuple[SampleSession, ...]:
    lifting = tuple(
        LoggedSet(load_kg=_LIFT_KG, reps=_LIFT_REPS, done=True) for _ in range(_LIFT_SETS)
    )
    tonnes = _LIFT_SETS * _LIFT_KG * _LIFT_REPS / 1000
    return (
        SampleSession(
            "lift", SESSION_MINUTES, None, tonnes, _score(catalog, rules, "squat", lifting)
        ),
        _cardio(catalog, rules, "run", "outrun", 10),
        _cardio(catalog, rules, "swim", "swim", 2.5),
    )


def build_public_rules(
    catalog: Catalog, rules: ScoringRules, rank_step: int, rank_count: int
) -> PublicRules:
    """Everything the landing page lists."""
    swim = catalog.exercise("swim")
    return PublicRules(
        points=rules,
        rank_step=rank_step,
        rank_count=rank_count,
        swim_km_factor=swim.km_factor if swim else 1.0,
        quests=load_quests(),
        badges=load_badges(),
        sessions=_sample_sessions(catalog, rules),
    )
