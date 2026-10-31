"""Workout request and response models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, StringConstraints
from typing_extensions import Annotated

from models.me import Color

WorkoutName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class SetModel(BaseModel):
    """One set: load + reps for lifts, minutes + km for cardio."""

    load_kg: float | None = Field(default=None, ge=0, le=1000)
    reps: int | None = Field(default=None, ge=0, le=1000)
    minutes: int | None = Field(default=None, ge=0, le=600)
    km: float | None = Field(default=None, ge=0, le=200)
    done: bool = False


class ExerciseInput(BaseModel):
    """An exercise and its sets, as the logger holds them."""

    exercise_id: str = Field(max_length=32)
    sets: list[SetModel] = Field(max_length=20)


class StartWorkoutRequest(BaseModel):
    """Start from a routine (pre-filled) or empty (routine_id null)."""

    routine_id: str | None = Field(default=None, max_length=32)
    name: WorkoutName | None = None


class SaveWorkoutRequest(BaseModel):
    """The full logger state. Replaces every exercise and set."""

    name: WorkoutName | None = None
    exercises: list[ExerciseInput] = Field(max_length=20)


class ExerciseOutput(BaseModel):
    """An exercise with its sets and last time's sets."""

    exercise_id: str
    sets: list[SetModel]
    previous_sets: list[SetModel]


class WorkoutResponse(BaseModel):
    """An in-progress workout. `live_points` is what finishing now would pay."""

    id: uuid.UUID
    name: str
    routine_id: str | None
    started_at: datetime
    exercises: list[ExerciseOutput]
    live_points: int


class LineItemModel(BaseModel):
    """A scoring line: i18n key, variables, points."""

    key: str
    vars: dict[str, int | float | str]
    points: int


class PersonalRecordModel(BaseModel):
    """A new PR set in this workout."""

    exercise_id: str
    load_kg: float
    reps: int


class FinishResponse(BaseModel):
    """The finish screen: every line item, the total and how the week stands."""

    workout_id: uuid.UUID
    name: str
    started_at: datetime
    finished_at: datetime
    total: int
    line_items: list[LineItemModel]
    volume_kg: float
    cardio_minutes: int
    completed_sets: int
    vs_last_pct: int | None
    prs: list[PersonalRecordModel]
    workouts_this_week: int
    weekly_target: int


class WeekResponse(BaseModel):
    """The member's workouts this crew-local week."""

    workouts: int
    target: int
    leg_event_active: bool


class TrainingNowItem(BaseModel):
    """A crew member with a workout in progress."""

    user_id: uuid.UUID
    display_name: str
    initials: str
    color: Color
    workout_name: str
    routine_id: str | None
    started_at: datetime
    current_exercise_id: str | None
