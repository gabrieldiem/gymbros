"""Request and response models for the backoffice."""

import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from models.me import Color

CrewName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
TimeZone = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=140)]


class OverviewResponse(BaseModel):
    """Totals, and the last seven days."""

    model_config = ConfigDict(from_attributes=True)

    users: int
    crews: int
    users_without_crew: int
    workouts: int
    recent_workouts: int
    recent_active_users: int
    recent_points: int


class AdminCrewResponse(BaseModel):
    """A crew in the backoffice."""

    id: uuid.UUID
    name: str
    time_zone: str
    invite_code: str
    members: int
    points: int


class AdminMemberResponse(BaseModel):
    """An account in the backoffice."""

    id: uuid.UUID
    email: str
    display_name: str
    initials: str
    color: Color
    crew_name: str | None
    points: int
    workouts: int
    last_workout_at: datetime | None
    created_at: datetime
    is_admin: bool


class AdminActionResponse(BaseModel):
    """A row of the audit log."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    admin_email: str
    action: str
    target: str
    details: dict[str, Any]
    created_at: datetime


class CreateCrewRequest(BaseModel):
    """A new crew."""

    name: CrewName
    time_zone: TimeZone


class UpdateCrewRequest(BaseModel):
    """Only the fields that are sent change."""

    name: CrewName | None = None
    time_zone: TimeZone | None = None


class AdjustPointsRequest(BaseModel):
    """A correction to a member's points, in either direction."""

    points: int = Field(ge=-5000, le=5000)
    reason: Reason
