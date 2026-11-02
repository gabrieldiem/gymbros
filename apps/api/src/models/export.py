"""Your training as a file: everything you logged, in a shape meant to outlast this app."""

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel

from models.gyms import GymModel


class ExportAccount(BaseModel):
    """Who this export belongs to."""

    display_name: str
    email: str
    language: str
    crew: str | None
    created_at: datetime


class ExportSet(BaseModel):
    """A set as logged. `load_kg` is the whole weight, `bar_kg` the bar inside it."""

    load_kg: float | None
    bar_kg: float | None
    reps: int | None
    minutes: int | None
    km: float | None
    done: bool


class ExportExercise(BaseModel):
    """An exercise in a workout."""

    exercise_id: str
    name: str
    sets: list[ExportSet]


class ExportPointLine(BaseModel):
    """A line of what a workout paid: an i18n key with its variables."""

    key: str
    vars: dict[str, Any]
    points: int


class ExportWorkout(BaseModel):
    """A finished workout."""

    id: uuid.UUID
    name: str
    routine_id: str | None
    gym: str | None
    performed_on: date | None
    started_at: datetime
    finished_at: datetime
    points: int
    volume_kg: float
    effort_km: float
    photo_url: str | None
    exercises: list[ExportExercise]
    point_lines: list[ExportPointLine]


class ExportRecord(BaseModel):
    """A PR. For cardio, `load_kg` holds the km and `reps` the minutes."""

    exercise_id: str
    load_kg: float
    bar_kg: float | None
    reps: int
    e1rm: float
    achieved_at: datetime


class ExportResponse(BaseModel):
    """The whole file."""

    format: Literal["gymbros-export"] = "gymbros-export"
    version: Literal[1] = 1
    exported_at: datetime
    account: ExportAccount
    gyms: list[GymModel]
    personal_records: list[ExportRecord]
    workouts: list[ExportWorkout]
