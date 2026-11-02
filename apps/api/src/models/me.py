"""The signed-in user's profile, as returned by /api/me and the auth endpoints."""

import uuid

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Annotated

from models.auth import DisplayName, InviteCode, Language

# A name from the crew palette, or any color from the picker.
Color = Annotated[str, StringConstraints(pattern=r"^(volt|red|cyan|pink|violet|#[0-9a-fA-F]{6})$")]


class CrewResponse(BaseModel):
    """The crew the user belongs to."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    time_zone: str
    invite_code: str


class MeResponse(BaseModel):
    """The signed-in user. `crew` is null until they join one."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str
    initials: str
    avatar_url: str | None = None
    color: Color
    language: Language
    rest_seconds: int
    crew: CrewResponse | None
    is_admin: bool = False


class UpdateMeRequest(BaseModel):
    """Profile changes. Omitted fields stay as they are."""

    display_name: DisplayName | None = None
    # Up to two characters, which can be emoji. services/avatar_text.py decides.
    initials: str | None = Field(default=None, max_length=64)
    color: Color | None = None
    language: Language | None = None
    rest_seconds: int | None = Field(default=None, ge=30, le=300)


class JoinCrewRequest(BaseModel):
    """Join a crew with the code a friend shared."""

    invite_code: InviteCode


class DeleteAccountRequest(BaseModel):
    """The account's email, typed again to confirm."""

    confirm_email: str


class InviteResponse(BaseModel):
    """What an invite link shows before signing in."""

    crew_name: str
    members: int
