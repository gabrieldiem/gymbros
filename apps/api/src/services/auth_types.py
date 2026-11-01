"""Data containers for the auth service."""

from dataclasses import dataclass

from db.tables.user import User


@dataclass(frozen=True, slots=True)
class DevLogin:
    """An email-only sign-in for demo and e2e accounts, already validated by the API model."""

    email: str
    language: str = "en"
    display_name: str | None = None
    invite_code: str | None = None


@dataclass(frozen=True, slots=True)
class LoggedIn:
    """A user, the raw session token to put in the cookie, and whether the account is new."""

    user: User
    token: str
    created: bool = False
