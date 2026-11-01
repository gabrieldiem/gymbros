"""Request and response models for signing in."""

from typing import Literal

from pydantic import BaseModel, EmailStr, StringConstraints
from typing_extensions import Annotated

DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]
InviteCode = Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=20)]
Language = Literal["en", "es"]


class DevLoginRequest(BaseModel):
    """Sign in by email alone (demo and e2e accounts; never available in production)."""

    email: EmailStr
    language: Language = "en"
    display_name: DisplayName | None = None
    invite_code: InviteCode | None = None


class AuthOptionsResponse(BaseModel):
    """Which ways to sign in this server offers."""

    google: bool
    dev_login: bool
