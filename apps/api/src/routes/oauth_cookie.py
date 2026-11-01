"""The cookie holding a Google sign-in attempt for the trip to Google and back."""

from fastapi import Response

from settings import Settings

OAUTH_COOKIE = "gymbros_oauth"
_PATH = "/api/auth/google"
_MAX_AGE_SECONDS = 600


def set_oauth_cookie(response: Response, value: str, settings: Settings) -> None:
    """SameSite=Lax still travels on Google's top-level redirect back to the callback."""
    response.set_cookie(
        key=OAUTH_COOKIE,
        value=value,
        max_age=_MAX_AGE_SECONDS,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=_PATH,
    )


def clear_oauth_cookie(response: Response, settings: Settings) -> None:
    """An attempt is used once."""
    response.delete_cookie(
        key=OAUTH_COOKIE,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path=_PATH,
    )
