"""Uploaded profile pictures."""

import uuid

from fastapi import APIRouter, Depends, Response

from db.tables.user import User
from dependencies import get_avatar_service, get_current_user
from models.errors import error_responses
from services.avatar_service import AvatarService

router = APIRouter(prefix="/avatars", tags=["Me"])

_A_YEAR = 365 * 24 * 3600


@router.get("/{user_id}", responses=error_responses(401, 404))
async def get_avatar(
    user_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    avatars: AvatarService = Depends(get_avatar_service),
) -> Response:
    """A member's picture. Its URL changes with each upload, so it can be cached for good."""
    avatar = await avatars.view(viewer, user_id)
    return Response(
        content=avatar.image,
        media_type=avatar.content_type,
        headers={
            "Cache-Control": f"private, max-age={_A_YEAR}, immutable",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )
