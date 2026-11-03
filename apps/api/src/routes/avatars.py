"""Uploaded profile pictures."""

import uuid

from fastapi import APIRouter, Depends, Response

from db.tables.user import User
from dependencies import get_avatar_service, get_current_user
from models.errors import error_responses
from routes.uploads import image_response
from services.avatar_service import AvatarService

router = APIRouter(prefix="/avatars", tags=["Me"])


@router.get("/{user_id}", responses=error_responses(401, 404))
async def get_avatar(
    user_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    avatars: AvatarService = Depends(get_avatar_service),
) -> Response:
    """A member's picture. Its URL changes with each upload, so it can be cached for good."""
    avatar = await avatars.view(viewer, user_id)
    return image_response(avatar.image, avatar.content_type)
