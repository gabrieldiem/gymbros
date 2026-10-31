"""Data containers for the auth service."""

from dataclasses import dataclass

from db.tables.user import User


@dataclass(frozen=True, slots=True)
class Registration:
    """A sign-up request, already validated by the API model."""

    email: str
    password: str
    display_name: str
    language: str
    invite_code: str | None = None


@dataclass(frozen=True, slots=True)
class LoggedIn:
    """A user plus the raw session token to put in the cookie."""

    user: User
    token: str
