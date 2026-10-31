"""Crew tab models: feed, reactions, comments, nudges, notifications, hall of fame."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, StringConstraints, model_validator
from typing_extensions import Annotated

from models.me import Color

ReactionKind = Literal["fist", "fire"]
QuickReply = Literal["q_light", "q_beast", "q_form", "q_six", "q_spot", "q_respect"]
CommentBody = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=140)]


class ActorModel(BaseModel):
    """A crew member as shown on cards and avatars."""

    user_id: uuid.UUID
    display_name: str
    initials: str
    color: Color


class ReactionsModel(BaseModel):
    """Counts per kind and which ones you added."""

    fist: int
    fire: int
    mine: list[ReactionKind]


class CommentModel(BaseModel):
    """A comment: `body` (the member's words) or `quick_key` (rendered with t())."""

    id: uuid.UUID
    author: ActorModel
    body: str | None
    quick_key: str | None
    created_at: datetime


class FeedItemModel(BaseModel):
    """A feed card. `vars` depend on `kind` (workout, rank_up, badge)."""

    id: uuid.UUID
    kind: str
    actor: ActorModel
    created_at: datetime
    vars: dict[str, Any]
    reactions: ReactionsModel
    comments: list[CommentModel]
    is_mine: bool


class InactiveModel(BaseModel):
    """A member to nudge: no workout for `days` days."""

    member: ActorModel
    days: int


class FeedResponse(BaseModel):
    """A page of the feed, newest first. Pass `next_before` back as `before` for more."""

    items: list[FeedItemModel]
    inactive: list[InactiveModel]
    next_before: datetime | None


class ReactRequest(BaseModel):
    """Toggle a reaction."""

    kind: ReactionKind


class CommentRequest(BaseModel):
    """Exactly one of `body` and `quick_key`."""

    body: CommentBody | None = None
    quick_key: QuickReply | None = None

    @model_validator(mode="after")
    def _one_of(self) -> "CommentRequest":
        if (self.body is None) == (self.quick_key is None):
            raise ValueError("send either body or quick_key")
        return self


class NudgeRequest(BaseModel):
    """Who to nudge."""

    user_id: uuid.UUID


class NotificationModel(BaseModel):
    """An inbox entry: i18n key + vars, where it links to, and who caused it."""

    id: uuid.UUID
    key: str
    vars: dict[str, Any]
    link: str
    created_at: datetime
    read: bool
    actor: ActorModel | None


class InboxResponse(BaseModel):
    """The newest notifications and the unread count."""

    items: list[NotificationModel]
    unread: int


class ImprovedModel(BaseModel):
    """A member's improvement against themselves, in %."""

    member: ActorModel
    pct: int


class RecordModel(BaseModel):
    """A crew record (`key` + `vars`) and who holds it."""

    key: str
    holder: ActorModel
    vars: dict[str, Any]


class HallOfFameResponse(BaseModel):
    """Most improved (top 3) and crew records."""

    most_improved: list[ImprovedModel]
    records: list[RecordModel]
