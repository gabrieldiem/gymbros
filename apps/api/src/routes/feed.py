"""The Crew feed: posts, reactions and comments."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request, Response, status

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
from routes.uploads import image_response, read_upload
from services.feed_service import FeedService
from services.images import MAX_PHOTO_BYTES
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


@router.post(
    "/comments/{comment_id}/reactions",
    response_model=ReactionsModel,
    responses=error_responses(401, 403, 404, 422),
)
async def react_to_comment(
    comment_id: uuid.UUID,
    body: ReactRequest,
    member: Member = Depends(get_current_member),
    feed: FeedService = Depends(get_feed_service),
) -> ReactionsModel:
    """Add an emoji to a comment, or take it off."""
    return to_reactions(await feed.react_to_comment(member, comment_id, body.kind))


@router.post(
    "/{item_id}/comments/photo",
    status_code=status.HTTP_201_CREATED,
    response_model=CommentModel,
    responses=error_responses(401, 403, 404, 413, 415),
)
async def add_photo_comment(
    item_id: uuid.UUID,
    request: Request,
    caption: str | None = Query(default=None, max_length=140),
    member: Member = Depends(get_current_member),
    feed: FeedService = Depends(get_feed_service),
) -> CommentModel:
    """Answer a post with a picture. The body is the image itself."""
    data = await read_upload(request, MAX_PHOTO_BYTES)
    text = caption.strip() if caption else None
    return to_comment(await feed.comment_with_photo(member, item_id, data, text or None))


@router.get("/comments/{comment_id}/photo", responses=error_responses(401, 403, 404))
async def get_comment_photo(
    comment_id: uuid.UUID,
    member: Member = Depends(get_current_member),
    feed: FeedService = Depends(get_feed_service),
) -> Response:
    """The picture on a comment, for its crew."""
    photo = await feed.comment_photo(member, comment_id)
    return image_response(photo.image, photo.content_type)
