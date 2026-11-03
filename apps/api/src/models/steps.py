"""Logging steps and the steps climb."""

import uuid
from datetime import date

from pydantic import BaseModel, Field, model_validator

from models.social_mappers import to_actor
from services.steps_service import MyEntry, StepsDashboard, StepsService


class LogStepsRequest(BaseModel):
    """A total of steps for a day (`start_date` alone) or a period, both ends included."""

    start_date: date
    end_date: date | None = None
    steps: int = Field(gt=0, le=10_000_000)

    @model_validator(mode="after")
    def _one_day_by_default(self) -> "LogStepsRequest":
        if self.end_date is None:
            self.end_date = self.start_date
        return self


class StepEntryModel(BaseModel):
    """Something you logged."""

    id: uuid.UUID
    start_date: date
    end_date: date
    steps: int
    points: int
    removable: bool = True


class StepStandingModel(BaseModel):
    """A member's place on the steps climb."""

    user_id: uuid.UUID
    display_name: str
    initials: str
    avatar_url: str | None
    color: str
    steps: int
    position: int
    is_me: bool


class StepDayModel(BaseModel):
    """Your steps on a day."""

    day: date
    steps: int


class StepsResponse(BaseModel):
    # pylint: disable=too-few-public-methods
    """The steps page."""

    mode: str
    summit: int
    camp_step: int
    steps_per_point: int
    daily_cap: int
    today: date
    earliest: date
    taken_days: list[date]
    standings: list[StepStandingModel]
    last_days: list[StepDayModel]
    my_week: int
    my_total: int
    my_best_day: int
    entries: list[StepEntryModel]


def to_entry(item: MyEntry) -> StepEntryModel:
    """Something you logged, for the list."""
    entry = item.entry
    return StepEntryModel(
        id=entry.id,
        start_date=entry.start_date,
        end_date=entry.end_date,
        steps=entry.steps,
        points=entry.points,
        removable=item.removable,
    )


def to_steps_response(view: StepsDashboard, service: StepsService, me: uuid.UUID) -> StepsResponse:
    """The whole page."""
    return StepsResponse(
        mode=view.mode,
        summit=view.summit,
        camp_step=service.camp_step(view.summit),
        steps_per_point=service.rules.per_point,
        daily_cap=service.rules.daily_cap,
        today=view.today,
        earliest=view.earliest,
        taken_days=list(view.taken_days),
        standings=[
            StepStandingModel(
                **to_actor(s.user).model_dump(),
                steps=s.steps,
                position=s.position,
                is_me=s.user.id == me,
            )
            for s in view.standings
        ],
        last_days=[StepDayModel(day=day, steps=steps) for day, steps in view.last_days],
        my_week=view.my_week,
        my_total=view.my_total,
        my_best_day=view.my_best_day,
        entries=[to_entry(item) for item in view.entries],
    )
