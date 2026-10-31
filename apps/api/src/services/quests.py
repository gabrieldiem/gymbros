"""Weekly quests: definitions from resources/quests.json and a typed registry of metrics."""

import json
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from services.scoring_types import WorkoutLog
from services.training_rules import effective_load, is_completed

QUESTS_PATH = Path(__file__).resolve().parent.parent / "resources" / "quests.json"


@dataclass(frozen=True, slots=True)
class WeekActivity:
    """What a member did this week, as quests see it."""

    leg_workouts: int
    ppl_groups: frozenset[str]
    volume_kg: float
    cardio_minutes: int


@dataclass(frozen=True, slots=True)
class Quest:
    """A weekly quest: reach `goal` on `metric` for a `bonus`."""

    id: str
    metric: str
    goal: float
    bonus: int


# Open/closed: a new quest is a JSON entry plus, if needed, one metric registered here.
QUEST_METRICS: dict[str, Callable[[WeekActivity], float]] = {
    "leg_workouts": lambda a: a.leg_workouts,
    "ppl_groups": lambda a: len(a.ppl_groups),
    "volume_tonnes": lambda a: a.volume_kg / 1000,
    "cardio_minutes": lambda a: a.cardio_minutes,
}


@cache
def load_quests() -> tuple[Quest, ...]:
    """The weekly quests, validated against the metric registry."""
    raw = json.loads(QUESTS_PATH.read_text(encoding="utf-8"))["quests"]
    quests = tuple(Quest(q["id"], q["metric"], q["goal"], q["bonus"]) for q in raw)
    unknown = [q.metric for q in quests if q.metric not in QUEST_METRICS]
    if unknown:
        raise ValueError(f"Unknown quest metrics: {unknown}")
    return quests


def quest_progress(quest: Quest, activity: WeekActivity) -> float:
    """Raw progress towards the quest's goal."""
    return QUEST_METRICS[quest.metric](activity)


def week_activity(logs: Iterable[WorkoutLog], bodyweight_kg: float) -> WeekActivity:
    """Fold a week's workouts into quest inputs. Only completed sets count."""
    legs = minutes = 0
    volume = 0.0
    groups: set[str] = set()
    for log in logs:
        trained_legs = False
        for logged in log.exercises:
            done = [s for s in logged.sets if is_completed(logged.exercise, s)]
            if not done:
                continue
            exercise = logged.exercise
            trained_legs |= exercise.group == "Legs"
            if exercise.ppl:
                groups.add(exercise.ppl)
            if exercise.is_cardio:
                minutes += sum(s.minutes or 0 for s in done)
            else:
                volume += sum(
                    effective_load(exercise, s.load_kg, bodyweight_kg) * (s.reps or 0) for s in done
                )
        legs += int(trained_legs)
    return WeekActivity(legs, frozenset(groups), volume, minutes)
