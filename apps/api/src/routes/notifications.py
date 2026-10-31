"""The notifications inbox."""

from fastapi import APIRouter, Depends, status

from db.tables.user import User
from dependencies import get_current_user, get_inbox_service
from models.errors import error_responses
from models.social import InboxResponse
from models.social_mappers import to_inbox_response
from services.inbox_service import InboxService

router = APIRouter(prefix="/notifications", tags=["Crew"])


@router.get("", response_model=InboxResponse, responses=error_responses(401))
async def get_inbox(
    user: User = Depends(get_current_user),
    inbox: InboxService = Depends(get_inbox_service),
) -> InboxResponse:
    """The newest notifications and how many are unread."""
    return to_inbox_response(await inbox.inbox(user))


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT, responses=error_responses(401))
async def mark_all_read(
    user: User = Depends(get_current_user),
    inbox: InboxService = Depends(get_inbox_service),
) -> None:
    """Mark the whole inbox as read."""
    await inbox.mark_all_read(user)
