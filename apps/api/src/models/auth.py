"""Request models for sign-up and login."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints
from typing_extensions import Annotated

DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=24)]
Password = Annotated[str, Field(min_length=8, max_length=128)]
InviteCode = Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=20)]
Language = Literal["en", "es"]


class RegisterRequest(BaseModel):
    """Create an account. With an invite code, the new user joins that crew too."""

    email: EmailStr
    password: Password
    display_name: DisplayName
    language: Language = "en"
    invite_code: InviteCode | None = None


class LoginRequest(BaseModel):
    """Email and password."""

    email: EmailStr
    password: Annotated[str, Field(min_length=1, max_length=128)]
