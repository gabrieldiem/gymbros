"""Request and response models for the backoffice."""

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from models.auth import Language
from models.me import Color

CrewName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
TimeZone = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
CustomCode = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
MaxUses = Annotated[int, Field(ge=1, le=100_000)]
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
    invite_uses: int
    invite_max_uses: int | None
    invite_expires_at: datetime | None
    invite_status: Literal["active", "expired", "used_up"]
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
    """A new crew. Without a code it gets a random one; limits are optional."""

    name: CrewName
    time_zone: TimeZone
    invite_code: CustomCode | None = None
    invite_max_uses: MaxUses | None = None
    invite_expires_at: AwareDatetime | None = None


class UpdateCrewRequest(BaseModel):
    """Only the fields that are sent change. A limit sent as null is removed."""

    name: CrewName | None = None
    time_zone: TimeZone | None = None
    invite_code: CustomCode | None = None
    invite_max_uses: MaxUses | None = None
    invite_expires_at: AwareDatetime | None = None


class SendInviteRequest(BaseModel):
    """Who to invite. The language applies unless they already have an account with their own."""

    email: EmailStr
    language: Language = "en"


class InviteSentResponse(BaseModel):
    """`sent` says if the email went out. `link` is there to share it by hand if it didn't."""

    model_config = ConfigDict(from_attributes=True)

    sent: bool
    link: str
    existing_account: bool


class AdjustPointsRequest(BaseModel):
    """A correction to a member's points, in either direction."""

    points: int = Field(ge=-5000, le=5000)
    reason: Reason
