"""Data containers for the Crew tab."""

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from db.tables.comment import Comment
from db.tables.feed_item import FeedItem
from db.tables.notification import Notification
from db.tables.user import User


@dataclass(frozen=True, slots=True)
class CommentView:
    """A comment with its author."""

    comment: Comment
    author: User


@dataclass(frozen=True, slots=True)
class ReactionSummary:
    """Counts per reaction kind and the kinds the reader added."""

    counts: dict[str, int]
    mine: frozenset[str]


@dataclass(frozen=True, slots=True)
class FeedEntry:
    """A feed item with its author, reactions and comments."""

    item: FeedItem
    actor: User
    reactions: ReactionSummary
    comments: tuple[CommentView, ...]


@dataclass(frozen=True, slots=True)
class InactiveMember:
    """A member who hasn't trained for a while (the Nudge prompt)."""

    user: User
    days: int


@dataclass(frozen=True, slots=True)
class FeedPage:
    """One page of the feed. `next_before` is the cursor for the next page."""

    entries: tuple[FeedEntry, ...]
    inactive: tuple[InactiveMember, ...] = ()
    next_before: tuple[datetime, uuid.UUID] | None = None


@dataclass(frozen=True, slots=True)
class InboxEntry:
    """A notification with the member who caused it."""

    notification: Notification
    actor: User | None


@dataclass(frozen=True, slots=True)
class Inbox:
    """The newest notifications and how many are unread."""

    entries: tuple[InboxEntry, ...]
    unread: int


@dataclass(frozen=True, slots=True)
class ImprovedMember:
    """A member and their improvement against themselves, in %."""

    user: User
    pct: int


@dataclass(frozen=True, slots=True)
class CrewRecord:
    """A crew record: what, who holds it, and the value (key + vars)."""

    key: str
    holder: User
    vars: dict[str, int | float | str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class HallOfFame:
    """Most improved (top 3) and crew records."""

    most_improved: tuple[ImprovedMember, ...]
    records: tuple[CrewRecord, ...]
