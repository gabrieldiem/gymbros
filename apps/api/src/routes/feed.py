"""The Crew feed: posts, reactions and comments."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status

from dependencies import get_current_member, get_feed_service, get_settings
from models.errors import error_responses
from models.social import (
    CommentModel,
    CommentRequest,
    FeedResponse,
    ReactionsModel,
    ReactRequest,
)
from models.social_mappers import to_comment, to_feed_response, to_reactions
from services.feed_service import FeedService
from services.member import Member
from settings import Settings

router = APIRouter(prefix="/feed", tags=["Crew"])


@router.get("", response_model=FeedResponse, responses=error_responses(401, 403))
async def get_feed(
    before: datetime | None = Query(None),
    before_id: uuid.UUID | None = Query(None),
    limit: int | None = Query(None, ge=1, le=50),
    member: Member = Depends(get_current_member),
    feed: FeedService = Depends(get_feed_service),
    settings: Settings = Depends(get_settings),
) -> FeedResponse:
    """Newest posts first. The first page also lists members to nudge."""
    cursor = (before, before_id) if before is not None and before_id is not None else None
    page = await feed.page(member, cursor, limit or settings.social_feed_page_size)
    return to_feed_response(page, member.user)


@router.post(
    "/{item_id}/reactions",
    response_model=ReactionsModel,
    responses=error_responses(401, 403, 404, 409),
)
async def toggle_reaction(
    item_id: uuid.UUID,
    body: ReactRequest,
    member: Member = Depends(get_current_member),
    feed: FeedService = Depends(get_feed_service),
) -> ReactionsModel:
    """Add or remove 👊 / 🔥 on someone else's post."""
    return to_reactions(await feed.react(member, item_id, body.kind))


@router.post(
    "/{item_id}/comments",
    status_code=status.HTTP_201_CREATED,
    response_model=CommentModel,
    responses=error_responses(401, 403, 404),
)
async def add_comment(
    item_id: uuid.UUID,
    body: CommentRequest,
    member: Member = Depends(get_current_member),
    feed: FeedService = Depends(get_feed_service),
) -> CommentModel:
    """Comment with your own words or a quick reply."""
    return to_comment(await feed.comment(member, item_id, body.body, body.quick_key))
