"""The exercise catalog and routines, loaded once from resources/catalog.json."""

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Literal

CATALOG_PATH = Path(__file__).resolve().parent.parent / "resources" / "catalog.json"

ExerciseType = Literal["w", "bw", "c", "s"]


@dataclass(frozen=True, slots=True)
class Exercise:
    """A catalog movement."""

    id: str
    name: str
    group: str
    type: ExerciseType
    barbell: bool
    ppl: str | None
    aliases_es: tuple[str, ...]
    # Cardio only: how many km of an easy reference run one km of this is worth (a swim km is 4).
    km_factor: float = 1.0
    # Stretching only: the minutes it starts with.
    default_minutes: int | None = None

    @property
    def is_cardio(self) -> bool:
        """Cardio entries are minutes + km instead of load × reps."""
        return self.type == "c"

    @property
    def is_stretch(self) -> bool:
        """Stretching entries are minutes for fixed points, not sets."""
        return self.type == "s"


@dataclass(frozen=True, slots=True)
class Routine:
    """A saved template of exercises."""

    id: str
    name: str
    exercise_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Catalog:
    """Every exercise and routine, with lookups."""

    exercises: tuple[Exercise, ...]
    routines: tuple[Routine, ...]

    def exercise(self, exercise_id: str) -> Exercise | None:
        """The exercise with this id, if any."""
        return next((ex for ex in self.exercises if ex.id == exercise_id), None)

    def routine(self, routine_id: str) -> Routine | None:
        """The routine with this id, if any."""
        return next((r for r in self.routines if r.id == routine_id), None)


def _parse(raw: dict) -> Catalog:
    exercises = tuple(
        Exercise(**{**item, "aliases_es": tuple(item["aliases_es"])}) for item in raw["exercises"]
    )
    routines = tuple(
        Routine(id=r["id"], name=r["name"], exercise_ids=tuple(r["exercise_ids"]))
        for r in raw["routines"]
    )
    return Catalog(exercises=exercises, routines=routines)


@cache
def load_catalog() -> Catalog:
    """The catalog, parsed once per process."""
    return _parse(json.loads(CATALOG_PATH.read_text(encoding="utf-8")))
