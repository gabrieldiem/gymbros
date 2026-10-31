"""The signed-in user's profile, as returned by /api/me and the auth endpoints."""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, StringConstraints
from typing_extensions import Annotated

from models.auth import DisplayName, InviteCode, Language

Color = Literal["volt", "red", "cyan", "pink", "violet"]
Initials = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9]{1,2}$")]


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
    color: Color
    language: Language
    crew: CrewResponse | None


class UpdateMeRequest(BaseModel):
    """Profile changes. Omitted fields stay as they are."""

    display_name: DisplayName | None = None
    initials: Initials | None = None
    color: Color | None = None
    language: Language | None = None


class JoinCrewRequest(BaseModel):
    """Join a crew with the code a friend shared."""

    invite_code: InviteCode
