"""Workout scoring: a pure function of (workout, history, week state, rules) → line items.

No database, no clock. Every rule here has a test in tests/test_scoring_service.py named after
the rule in docs/PRODUCT.md. Point values come from ScoringRules (settings.json), never literals.
"""

import math
from dataclasses import dataclass, replace

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
from services.training_rules import (
    LoggedSet,
    effective_load,
    effort_km,
    endurance_score,
    estimated_1rm,
    is_completed,
)

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
    # pylint: disable=too-many-instance-attributes
    completed_sets: int
    leg_sets: int
    volume_kg: float
    cardio_minutes: int
    cardio_km: float
    effort_km: float
    bests: tuple[RecordSet, ...]
    stretched: bool
    timed_minutes: int = 0
    timed_effort_km: float = 0.0
    custom_sets: int = 0


def score_workout(
    log: WorkoutLog, history: History, week: WeekState, rules: ScoringRules
) -> ScoreResult:
    """Score a finished (or in-progress, for the live preview) workout."""
    tally = _tally(log, rules)
    stretch = _stretch_items(tally, history, rules) + _custom_items(tally)
    if tally.completed_sets == 0:
        return ScoreResult(stretch, sum(item.points for item in stretch), 0.0, 0, 0, None, ())
    records = _records(tally.bests, history)
    vs_last = _vs_last_pct(tally, history, log, rules)
    items = (
        _base_items(tally, week, rules)
        + _pr_items(records, log, rules)
        + _week_items(week, rules)
        + _better_items(vs_last, rules)
        + stretch
    )
    return ScoreResult(
        line_items=items,
        total=sum(item.points for item in items),
        volume_kg=tally.volume_kg,
        cardio_minutes=tally.cardio_minutes,
        completed_sets=tally.completed_sets,
        vs_last_pct=vs_last,
        records=records,
        effort_km=tally.effort_km,
    )


def best_sets(log: WorkoutLog, rules: ScoringRules) -> tuple[RecordSet, ...]:
    """The best set of each exercise in this workout, PR or not."""
    return _tally(log, rules).bests


def _tally(log: WorkoutLog, rules: ScoringRules) -> _Tally:
    sets = legs = minutes = 0
    volume = km = effort = 0.0
    bests: list[RecordSet] = []
    stretched = False
    timed_minutes = custom_sets = 0
    timed_effort = 0.0
    for logged in log.exercises:
        done = [s for s in logged.sets if is_completed(logged.exercise, s)]
        if logged.exercise.is_custom:
            custom_sets += len(done)
            continue
        if logged.exercise.is_stretch:
            stretched = stretched or bool(done)
            continue
        sets += len(done)
        legs += len(done) if logged.exercise.group == "Legs" else 0
        if logged.exercise.is_cardio:
            minutes += sum(s.minutes or 0 for s in done)
            km += sum(s.km or 0 for s in done)
            effort += sum(effort_km(logged.exercise, s) for s in done)
            if logged.exercise.is_timed:
                timed_minutes += sum(s.minutes or 0 for s in done)
                timed_effort += sum(effort_km(logged.exercise, s) for s in done)
            best = _best_cardio(logged, done)
        else:
            volume += sum(_set_volume(logged, s, rules) for s in done)
            best = _best_set(logged, done, rules)
        if best is not None:
            bests.append(best)
    return _Tally(
        sets,
        legs,
        volume,
        minutes,
        km,
        effort,
        tuple(bests),
        stretched,
        timed_minutes,
        timed_effort,
        custom_sets,
    )


def _set_volume(logged: LoggedExercise, logged_set: LoggedSet, rules: ScoringRules) -> float:
    load = effective_load(logged.exercise, logged_set.load_kg, rules.bodyweight_kg)
    return load * (logged_set.reps or 0)


def _best_set(
    logged: LoggedExercise, done: list[LoggedSet], rules: ScoringRules
) -> RecordSet | None:
    best: RecordSet | None = None
    for logged_set in done:
        load = effective_load(logged.exercise, logged_set.load_kg, rules.bodyweight_kg)
        if load <= 0:
            continue  # With no weight there's nothing to beat, and no record to hold.
        e1rm = estimated_1rm(load, logged_set.reps or 0)
        if best is None or e1rm > best.e1rm:
            best = RecordSet(
                logged.exercise.id,
                logged_set.load_kg or 0.0,
                logged_set.reps or 0,
                e1rm,
                False,
                logged_set.bar_kg,
            )
    return best


def _best_cardio(logged: LoggedExercise, done: list[LoggedSet]) -> RecordSet | None:
    """The entry with the best endurance score. A cardio record stores km and minutes in the
    load_kg and reps fields, next to its score."""
    best: RecordSet | None = None
    for logged_set in done:
        points = endurance_score(logged.exercise, logged_set)
        if points is not None and (best is None or points > best.e1rm):
            best = RecordSet(
                logged.exercise.id, logged_set.km or 0.0, logged_set.minutes or 0, points, False
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
            records.append(replace(best, is_improvement=True))
    return tuple(records)


def _vs_last_pct(
    tally: _Tally, history: History, log: WorkoutLog, rules: ScoringRules
) -> int | None:
    """Change in work, where one effort km counts for the kg that pay the same points."""
    kg_per_effort_km = rules.cardio_effort_km * rules.volume_kg_per_point
    work = tally.volume_kg + tally.effort_km * kg_per_effort_km
    previous = (history.previous_routine_volume_kg or 0) + (
        history.previous_routine_effort_km * kg_per_effort_km
    )
    if log.routine_id is None or not previous or not work:
        return None
    return round((work / previous - 1) * 100)


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
    distance_effort = tally.effort_km - tally.timed_effort_km
    distance_points = math.floor(distance_effort * rules.cardio_effort_km)
    if distance_points > 0:
        km = _number(round(tally.cardio_km, 2))
        items.append(LineItem("ln_distance", {"km": km}, distance_points))
    timed_points = math.floor(tally.timed_effort_km * rules.cardio_effort_km)
    if timed_points > 0:
        items.append(LineItem("ln_intensity", {"minutes": tally.timed_minutes}, timed_points))
    return tuple(items)


def _pr_items(
    records: tuple[RecordSet, ...], log: WorkoutLog, rules: ScoringRules
) -> tuple[LineItem, ...]:
    cardio = {e.exercise.id for e in log.exercises if e.exercise.is_cardio}
    items = []
    for record in records:
        if not record.is_improvement:
            continue
        if record.exercise_id in cardio:
            variables = {
                "exercise_id": record.exercise_id,
                "km": _number(record.load_kg),
                "minutes": record.reps,
            }
            items.append(LineItem("ln_pr_distance", variables, rules.pr))
        else:
            variables = {
                "exercise_id": record.exercise_id,
                "load_kg": _number(record.load_kg),
                "reps": record.reps,
            }
            if record.bar_kg is not None:
                variables["bar_kg"] = _number(record.bar_kg)
            items.append(LineItem("ln_pr", variables, rules.pr))
    return tuple(items)


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


def _custom_items(tally: _Tally) -> tuple[LineItem, ...]:
    """Says it was logged, and that it pays nothing: a name anyone can type can't be balanced."""
    return (LineItem("ln_custom", {"n": tally.custom_sets}, 0),) if tally.custom_sets else ()


def _stretch_items(tally: _Tally, history: History, rules: ScoringRules) -> tuple[LineItem, ...]:
    if not tally.stretched or history.stretched_that_day:
        return ()
    return (LineItem("ln_stretch", {}, rules.stretching),)


def _better_items(vs_last_pct: int | None, rules: ScoringRules) -> tuple[LineItem, ...]:
    if vs_last_pct is None or vs_last_pct <= 0:
        return ()
    return (LineItem("ln_better", {"pct": vs_last_pct}, rules.better_than_last_time),)
