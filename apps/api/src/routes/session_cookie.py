"""The session cookie: httpOnly, SameSite=Lax, Secure when COOKIE_SECURE is on."""

from fastapi import Response

from settings import Settings


def set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    """Attach the session token."""
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_max_age_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    """Remove the session token."""
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
