"""Sign in with Google, dev login, log out. The session lives in an httpOnly cookie."""

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import (
    get_auth_service,
    get_email_sender,
    get_google_sign_in,
    get_profile_service,
    get_session,
    get_session_token,
    get_settings,
    logger,
)
from models.auth import AuthOptionsResponse, DevLoginRequest
from models.errors import error_responses
from models.mappers import to_me_response
from models.me import MeResponse
from routes.oauth_cookie import OAUTH_COOKIE, clear_oauth_cookie, set_oauth_cookie
from routes.session_cookie import clear_session_cookie, set_session_cookie
from services.auth_service import AuthService
from services.auth_types import DevLogin
from services.errors import GoogleSignInFailed
from services.google_identity import GoogleIdentity, GoogleSignIn
from services.oauth_attempt import OAuthAttempt
from services.profile_service import ProfileService
from services.welcome_email import EmailSender, welcome_email
from settings import Settings

router = APIRouter(prefix="/auth", tags=["Auth"])

SIGNED_IN_PATH = "/climb"
FAILED_PATH = "/login?auth_error=google"


def _redirect(settings: Settings, path: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.public_url}{path}", status_code=status.HTTP_302_FOUND)


@router.get("/options", response_model=AuthOptionsResponse)
async def options(settings: Settings = Depends(get_settings)) -> AuthOptionsResponse:
    """Which ways to sign in this server offers, so the web app shows the right buttons."""
    return AuthOptionsResponse(google=settings.google_enabled, dev_login=settings.dev_login_enabled)


@router.get("/google/start", include_in_schema=False)
async def google_start(
    lang: str = "en",
    google: GoogleSignIn | None = Depends(get_google_sign_in),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    """Send the browser to Google's account picker."""
    if google is None:
        return _redirect(settings, FAILED_PATH)
    attempt = OAuthAttempt.new(lang)
    response = RedirectResponse(google.authorization_url(attempt), status.HTTP_302_FOUND)
    set_oauth_cookie(response, attempt.to_cookie(), settings)
    return response


async def _identify(
    google: GoogleSignIn | None, cookie: str | None, code: str | None, state: str | None
) -> tuple[GoogleIdentity, OAuthAttempt]:
    """Check the callback against this browser's attempt, then ask Google who signed in."""
    attempt = OAuthAttempt.from_cookie(cookie)
    attempt.check_state(state)
    if google is None or not code:
        raise GoogleSignInFailed("no code, or Google sign-in is not configured")
    return await google.identify(code, attempt), attempt


@router.get("/google/callback", include_in_schema=False)
async def google_callback(  # pylint: disable=too-many-arguments,too-many-positional-arguments
    background: BackgroundTasks,
    code: str | None = None,
    state: str | None = None,
    cookie: str | None = Cookie(default=None, alias=OAUTH_COOKIE),
    google: GoogleSignIn | None = Depends(get_google_sign_in),
    auth: AuthService = Depends(get_auth_service),
    email: EmailSender = Depends(get_email_sender),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    """Finish signing in and land on the app. The gates send members without a crew to /join."""
    try:
        identity, attempt = await _identify(google, cookie, code, state)
    except GoogleSignInFailed as error:
        logger.warning("Google sign-in failed: %s", error)
        failed = _redirect(settings, FAILED_PATH)
        clear_oauth_cookie(failed, settings)
        return failed
    logged_in = await auth.sign_in_with_google(identity, attempt.language)
    # The browser follows this redirect at once: its session must already be stored.
    await session.commit()
    if logged_in.created:
        user = logged_in.user
        message = welcome_email(user.email, user.display_name, user.language, settings.public_url)
        background.add_task(email.send, message)
    response = _redirect(settings, SIGNED_IN_PATH)
    set_session_cookie(response, logged_in.token, settings)
    clear_oauth_cookie(response, settings)
    return response


@router.post(
    "/dev-login",
    response_model=MeResponse,
    responses=error_responses(404),
    include_in_schema=False,
)
async def dev_login(
    body: DevLoginRequest,
    response: Response,
    auth: AuthService = Depends(get_auth_service),
    profiles: ProfileService = Depends(get_profile_service),
    settings: Settings = Depends(get_settings),
) -> MeResponse:
    """Sign in by email alone. 404 unless DEV_LOGIN_ENABLED (production won't start with it)."""
    if not settings.dev_login_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    logged_in = await auth.dev_log_in(DevLogin(**body.model_dump()))
    set_session_cookie(response, logged_in.token, settings)
    return to_me_response(await profiles.get(logged_in.user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def log_out(
    response: Response,
    token: str | None = Depends(get_session_token),
    auth: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> None:
    """End the session. Always succeeds, even without one."""
    await auth.log_out(token)
    clear_session_cookie(response, settings)
