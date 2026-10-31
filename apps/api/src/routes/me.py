"""The signed-in user's profile."""

from fastapi import APIRouter, Depends

from db.tables.user import User
from dependencies import get_current_user, get_profile_service
from models.errors import error_responses
from models.mappers import to_me_response
from models.me import MeResponse, UpdateMeRequest
from services.profile_service import ProfileChanges, ProfileService

router = APIRouter(prefix="/me", tags=["Me"])


@router.get("", response_model=MeResponse, responses=error_responses(401))
async def get_me(
    user: User = Depends(get_current_user),
    profiles: ProfileService = Depends(get_profile_service),
) -> MeResponse:
    """The signed-in user with their crew."""
    return to_me_response(await profiles.get(user))


@router.patch("", response_model=MeResponse, responses=error_responses(401))
async def update_me(
    body: UpdateMeRequest,
    user: User = Depends(get_current_user),
    profiles: ProfileService = Depends(get_profile_service),
) -> MeResponse:
    """Change display name, initials, color or language."""
    changes = ProfileChanges(**body.model_dump(exclude_unset=True))
    return to_me_response(await profiles.update(user, changes))
