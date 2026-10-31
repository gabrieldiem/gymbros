"""Workout scoring: a pure function of (workout, history, week state, rules) → line items.

No database, no clock. Every rule here has a test in tests/test_scoring_service.py named after
the rule in docs/PRODUCT.md. Point values come from ScoringRules (settings.json), never literals.
"""

import math
from dataclasses import dataclass

from services.scoring_types import (
    History,
    LineItem,
    LoggedExercise,
    RecordSet,
    ScoreResult,
    ScoringRules,
    WeekState,
    WorkoutLog,
)
from services.training_rules import LoggedSet, effective_load, estimated_1rm, is_completed

__all__ = [
    "History",
    "LineItem",
    "LoggedExercise",
    "LoggedSet",
    "ScoreResult",
    "ScoringRules",
    "WeekState",
    "WorkoutLog",
    "score_workout",
]

_PR_EPSILON = 0.01


@dataclass(frozen=True, slots=True)
class _Tally:
    completed_sets: int
    leg_sets: int
    volume_kg: float
    cardio_minutes: int
    bests: tuple[RecordSet, ...]


def score_workout(
    log: WorkoutLog, history: History, week: WeekState, rules: ScoringRules
) -> ScoreResult:
    """Score a finished (or in-progress, for the live preview) workout."""
    tally = _tally(log, rules)
    if tally.completed_sets == 0:
        return ScoreResult((), 0, 0.0, 0, 0, None, ())
    records = _records(tally.bests, history)
    vs_last = _vs_last_pct(tally.volume_kg, history, log)
    items = (
        _base_items(tally, week, rules)
        + _pr_items(records, rules)
        + _week_items(week, rules)
        + _better_items(vs_last, rules)
    )
    return ScoreResult(
        line_items=items,
        total=sum(item.points for item in items),
        volume_kg=tally.volume_kg,
        cardio_minutes=tally.cardio_minutes,
        completed_sets=tally.completed_sets,
        vs_last_pct=vs_last,
        records=records,
    )


def _tally(log: WorkoutLog, rules: ScoringRules) -> _Tally:
    sets = legs = minutes = 0
    volume = 0.0
    bests: list[RecordSet] = []
    for logged in log.exercises:
        done = [s for s in logged.sets if is_completed(logged.exercise, s)]
        sets += len(done)
        legs += len(done) if logged.exercise.group == "Legs" else 0
        if logged.exercise.is_cardio:
            minutes += sum(s.minutes or 0 for s in done)
            continue
        volume += sum(_set_volume(logged, s, rules) for s in done)
        best = _best_set(logged, done, rules)
        if best is not None:
            bests.append(best)
    return _Tally(sets, legs, volume, minutes, tuple(bests))


def _set_volume(logged: LoggedExercise, logged_set: LoggedSet, rules: ScoringRules) -> float:
    load = effective_load(logged.exercise, logged_set.load_kg, rules.bodyweight_kg)
    return load * (logged_set.reps or 0)


def _best_set(
    logged: LoggedExercise, done: list[LoggedSet], rules: ScoringRules
) -> RecordSet | None:
    best: RecordSet | None = None
    for logged_set in done:
        load = effective_load(logged.exercise, logged_set.load_kg, rules.bodyweight_kg)
        e1rm = estimated_1rm(load, logged_set.reps or 0)
        if best is None or e1rm > best.e1rm:
            best = RecordSet(
                logged.exercise.id, logged_set.load_kg or 0.0, logged_set.reps or 0, e1rm, False
            )
    return best


def _records(bests: tuple[RecordSet, ...], history: History) -> tuple[RecordSet, ...]:
    """New bests to store: a first log sets the baseline; later ones must beat the stored PR."""
    records = []
    for best in bests:
        stored = history.personal_records.get(best.exercise_id)
        if stored is None:
            records.append(best)
        elif best.e1rm > stored + _PR_EPSILON:
            records.append(RecordSet(best.exercise_id, best.load_kg, best.reps, best.e1rm, True))
    return tuple(records)


def _vs_last_pct(volume_kg: float, history: History, log: WorkoutLog) -> int | None:
    previous = history.previous_routine_volume_kg
    if log.routine_id is None or not previous:
        return None
    return round((volume_kg / previous - 1) * 100)


def _number(value: float) -> int | float:
    return int(value) if float(value).is_integer() else value


def _base_items(tally: _Tally, week: WeekState, rules: ScoringRules) -> tuple[LineItem, ...]:
    items = [
        LineItem("ln_show", {}, rules.showed_up),
        LineItem(
            "ln_sets", {"n": tally.completed_sets}, tally.completed_sets * rules.completed_set
        ),
    ]
    if week.leg_event_active and tally.leg_sets:
        bonus = tally.leg_sets * rules.leg_event_set_bonus
        items.append(LineItem("ln_leg_event", {"n": tally.leg_sets}, bonus))
    volume_points = math.floor(tally.volume_kg / rules.volume_kg_per_point)
    if volume_points > 0:
        items.append(LineItem("ln_vol", {"kg": round(tally.volume_kg)}, volume_points))
    if tally.cardio_minutes:
        minutes = tally.cardio_minutes
        items.append(LineItem("ln_cardio", {"minutes": minutes}, minutes * rules.cardio_minute))
    return tuple(items)


def _pr_items(records: tuple[RecordSet, ...], rules: ScoringRules) -> tuple[LineItem, ...]:
    return tuple(
        LineItem(
            "ln_pr",
            {"exercise_id": r.exercise_id, "load_kg": _number(r.load_kg), "reps": r.reps},
            rules.pr,
        )
        for r in records
        if r.is_improvement
    )


def _week_items(week: WeekState, rules: ScoringRules) -> tuple[LineItem, ...]:
    number = week.workouts_before + 1
    if number > rules.weekly_target:
        return (LineItem("ln_over", {"n": number}, rules.over_target),)
    if number < rules.weekly_target:
        return ()
    streak = week.previous_goal_streak + 1
    streak_points = min(streak * rules.goal_streak_per_week, rules.goal_streak_max)
    return (
        LineItem("ln_goal", {"n": rules.weekly_target}, rules.weekly_goal),
        LineItem("ln_streak", {"weeks": streak}, streak_points),
    )


def _better_items(vs_last_pct: int | None, rules: ScoringRules) -> tuple[LineItem, ...]:
    if vs_last_pct is None or vs_last_pct <= 0:
        return ()
    return (LineItem("ln_better", {"pct": vs_last_pct}, rules.better_than_last_time),)
