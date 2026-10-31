"""The exercise catalog, routines and the points table for "How you earn points"."""

from typing import Literal

from pydantic import BaseModel

from services.scoring_types import ScoringRules


class ExerciseModel(BaseModel):
    """A catalog exercise. `name` is the same in both languages."""

    id: str
    name: str
    group: Literal["Chest", "Legs", "Back", "Shoulders", "Arms", "Cardio"]
    type: Literal["w", "bw", "c"]
    barbell: bool
    ppl: Literal["push", "pull", "legs"] | None
    aliases_es: list[str]


class RoutineModel(BaseModel):
    """A routine template."""

    id: str
    name: str
    exercise_ids: list[str]


class CatalogResponse(BaseModel):
    """Everything the Train tab needs that rarely changes."""

    exercises: list[ExerciseModel]
    routines: list[RoutineModel]
    # Point values from settings.json, shown in "How you earn points". Never computed with.
    points: ScoringRules
    weekly_event: str | None
