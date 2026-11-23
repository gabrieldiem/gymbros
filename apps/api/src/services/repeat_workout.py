"""Repeating a recent workout: which ones to offer, and how a repeat starts. Pure functions."""

from collections.abc import Callable, Iterable
from dataclasses import replace

from db.tables.workout import Workout
from services.catalog import Exercise
from services.training_rules import is_completed, overload
from services.workout_mapping import to_entries
from services.workout_types import ExerciseEntry, RecentWorkout


def recent_workouts(newest_first: Iterable[Workout], limit: int) -> tuple[RecentWorkout, ...]:
    """The latest workouts, one per set of exercises, so three Push days show once."""
    seen: set[tuple[tuple[str, str | None], ...]] = set()
    recent: list[RecentWorkout] = []
    for workout in newest_first:
        entries = to_entries(workout)
        signature = tuple((e.exercise_id, e.custom_name) for e in entries)
        if not entries or signature in seen:
            continue
        seen.add(signature)
        recent.append(RecentWorkout(workout, entries))
        if len(recent) == limit:
            break
    return tuple(recent)


def repeated_entries(
    source: Workout, exercise_of: Callable[[str], Exercise], past: bool
) -> tuple[ExerciseEntry, ...]:
    """The source's exercises with the sets it completed, loaded to beat them (as they were, for a
    past day, like a routine). An exercise with nothing done is left out."""
    entries = []
    for entry in to_entries(source):
        exercise = exercise_of(entry.exercise_id)
        done = [s for s in entry.sets if is_completed(exercise, s)]
        if not done:
            continue
        sets = [replace(s, done=False) if past else overload(exercise, s) for s in done]
        entries.append(ExerciseEntry(entry.exercise_id, tuple(sets), entry.custom_name))
    return tuple(entries)
