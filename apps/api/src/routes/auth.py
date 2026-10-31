"""Register, log in, log out. The session lives in an httpOnly cookie."""

from fastapi import APIRouter, Depends, Response, status

from dependencies import (
    get_auth_service,
    get_profile_service,
    get_session_token,
    get_settings,
)
from models.auth import LoginRequest, RegisterRequest
from models.errors import error_responses
from models.mappers import to_me_response
from models.me import MeResponse
from routes.session_cookie import clear_session_cookie, set_session_cookie
from services.auth_service import AuthService
from services.auth_types import Registration
from services.profile_service import ProfileService
from settings import Settings

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=MeResponse,
    responses=error_responses(404, 409),
)
async def register(
    body: RegisterRequest,
    response: Response,
    auth: AuthService = Depends(get_auth_service),
    profiles: ProfileService = Depends(get_profile_service),
    settings: Settings = Depends(get_settings),
) -> MeResponse:
    """Create an account, optionally joining a crew by invite code, and sign in."""
    logged_in = await auth.register(Registration(**body.model_dump()))
    set_session_cookie(response, logged_in.token, settings)
    return to_me_response(await profiles.get(logged_in.user))


@router.post("/login", response_model=MeResponse, responses=error_responses(401))
async def log_in(
    body: LoginRequest,
    response: Response,
    auth: AuthService = Depends(get_auth_service),
    profiles: ProfileService = Depends(get_profile_service),
    settings: Settings = Depends(get_settings),
) -> MeResponse:
    """Sign in with email and password."""
    logged_in = await auth.log_in(body.email, body.password)
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
