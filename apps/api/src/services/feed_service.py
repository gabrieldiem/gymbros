"""The Crew feed: pages of items with reactions and comments, nudge prompts, react, comment."""

import asyncio
import uuid
from collections import Counter
from collections.abc import Callable
from datetime import datetime

from db.repositories.comment_photo_repository import CommentPhotoRepository
from db.repositories.crew_repository import CrewRepository
from db.repositories.feed_repository import FeedRepository
from db.repositories.user_repository import UserRepository
from db.repositories.workout_repository import WorkoutRepository
from db.tables.comment import Comment
from db.tables.comment_photo import CommentPhoto
from db.tables.feed_item import FeedItem
from services.badge_service import BadgeService
from services.emoji_text import shown_emoji, stored_kind
from services.errors import CommentNotFound, FeedItemNotFound
from services.images import MAX_PHOTO_BYTES, clean_image
from services.member import Member
from services.notifier import Notifier
from services.social_types import (
    CommentView,
    FeedEntry,
    FeedPage,
    InactiveMember,
    ReactionSummary,
)


class FeedService:
    """Reads the feed and handles reactions and comments."""

    def __init__(
        self,
        feed: FeedRepository,
        users: UserRepository,
        crews: CrewRepository,
        workouts: WorkoutRepository,
        notifier: Notifier,
        inactive_days: int,
        now: Callable[[], datetime],
        photos: CommentPhotoRepository,
        badges: BadgeService | None = None,
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._feed = feed
        self._users = users
        self._crews = crews
        self._workouts = workouts
        self._notifier = notifier
        self._inactive_days = inactive_days
        self._now = now
        self._badges = badges
        self._photos = photos

    async def page(
        self, member: Member, before: tuple[datetime, uuid.UUID] | None, limit: int
    ) -> FeedPage:
        """Newest first. The first page also carries the nudge prompts."""
        items = await self._feed.page(member.crew.id, before, limit)
        entries = await self._entries(member, items)
        inactive = await self._inactive(member) if before is None else ()
        last = items[-1] if len(items) == limit else None
        next_before = (last.created_at, last.id) if last else None
        return FeedPage(entries=entries, inactive=inactive, next_before=next_before)

    async def react(self, member: Member, item_id: uuid.UUID, kind: str) -> ReactionSummary:
        """Toggle an emoji on an item; the owner hears about new ones from others."""
        item = await self._item_in_crew(member, item_id)
        added = await self._feed.toggle_reaction(item.id, member.user.id, stored_kind(kind))
        if added:
            await self._notifier.send(
                [item.actor_id],
                member.user.id,
                "n_react",
                {"name": member.user.display_name, "kind": shown_emoji(kind), "item": item.kind},
                "/crew",
            )
            await self._check_badges(member)
        return self._summary(await self._feed.reactions([item.id]), member.user.id)

    async def react_to_comment(
        self, member: Member, comment_id: uuid.UUID, emoji: str
    ) -> ReactionSummary:
        """Toggle an emoji on a comment; its author hears about new ones from others."""
        comment = await self._comment_in_crew(member, comment_id)
        kind = shown_emoji(stored_kind(emoji))
        added = await self._feed.toggle_comment_reaction(comment.id, member.user.id, kind)
        if added:
            await self._notifier.send(
                [comment.user_id],
                member.user.id,
                "n_comment_react",
                {"name": member.user.display_name, "kind": kind},
                "/crew",
            )
        rows = await self._feed.comment_reactions([comment.id])
        return self._summary_of([(r.emoji, r.user_id) for r in rows], member.user.id)

    async def _comment_in_crew(self, member: Member, comment_id: uuid.UUID) -> Comment:
        comment = await self._feed.get_comment(comment_id)
        if comment is None:
            raise CommentNotFound(str(comment_id))
        item = await self._feed.get(comment.feed_item_id)
        if item is None or item.crew_id != member.crew.id:
            raise CommentNotFound(str(comment_id))
        return comment

    async def comment_with_photo(
        self, member: Member, item_id: uuid.UUID, data: bytes, caption: str | None
    ) -> CommentView:
        """Answer a post with a picture, cleaned before anything is stored."""
        item = await self._item_in_crew(member, item_id)
        clean = await asyncio.to_thread(clean_image, data, MAX_PHOTO_BYTES)
        now = self._now()
        comment = Comment(
            feed_item_id=item.id,
            user_id=member.user.id,
            body=caption,
            quick_key=None,
            photo_version=int(now.timestamp()),
            created_at=now,
        )
        view = await self._add_comment(member, item, comment)
        await self._photos.add(
            CommentPhoto(
                comment_id=comment.id,
                image=clean.data,
                content_type=clean.content_type,
                updated_at=now,
            )
        )
        return view

    async def comment_photo(self, member: Member, comment_id: uuid.UUID) -> CommentPhoto:
        """The picture on a comment, for its crew."""
        comment = await self._comment_in_crew(member, comment_id)
        photo = await self._photos.get(comment.id)
        if photo is None:
            raise CommentNotFound(str(comment_id))
        return photo

    async def comment(
        self, member: Member, item_id: uuid.UUID, body: str | None, quick_key: str | None
    ) -> CommentView:
        """Add a comment (text or a quick reply); the owner and others in the thread are told."""
        item = await self._item_in_crew(member, item_id)
        return await self._add_comment(
            member,
            item,
            Comment(
                feed_item_id=item.id,
                user_id=member.user.id,
                body=body,
                quick_key=quick_key,
                created_at=self._now(),
            ),
        )

    async def _add_comment(self, member: Member, item: FeedItem, comment: Comment) -> CommentView:
        comment = await self._feed.add_comment(comment)
        await self._notifier.send(
            [item.actor_id],
            member.user.id,
            "n_comment",
            {"name": member.user.display_name, "item": item.kind},
            "/crew",
        )
        thread = await self._feed.comments([item.id])
        others = {c.user_id for c in thread.get(item.id, [])} - {item.actor_id}
        await self._notifier.send(
            others, member.user.id, "n_reply", {"name": member.user.display_name}, "/crew"
        )
        await self._check_badges(member)
        return CommentView(
            comment=comment,
            author=member.user,
            reactions=ReactionSummary(counts={}, mine=frozenset()),
        )

    async def _check_badges(self, member: Member) -> None:
        """Hype crew and Trash talker unlock from reactions and comments."""
        if self._badges is not None:
            await self._badges.check_and_store(member)

    async def _item_in_crew(self, member: Member, item_id: uuid.UUID) -> FeedItem:
        item = await self._feed.get(item_id)
        if item is None or item.crew_id != member.crew.id:
            raise FeedItemNotFound(str(item_id))
        return item

    async def _entries(self, member: Member, items: list[FeedItem]) -> tuple[FeedEntry, ...]:
        ids = [item.id for item in items]
        reactions = await self._feed.reactions(ids)
        comments = await self._feed.comments(ids)
        on_comments: dict[uuid.UUID, list[tuple[str, uuid.UUID]]] = {}
        comment_ids = [c.id for thread in comments.values() for c in thread]
        for row in await self._feed.comment_reactions(comment_ids):
            on_comments.setdefault(row.comment_id, []).append((row.emoji, row.user_id))
        authors = {item.actor_id for item in items} | {
            c.user_id for thread in comments.values() for c in thread
        }
        users = await self._users.get_many(authors)
        photos = await self._workouts.photo_versions(
            [item.workout_id for item in items if item.workout_id]
        )
        return tuple(
            FeedEntry(
                item=item,
                actor=users[item.actor_id],
                reactions=self._summary(
                    [r for r in reactions if r.feed_item_id == item.id], member.user.id
                ),
                comments=tuple(
                    CommentView(
                        c,
                        users[c.user_id],
                        self._summary_of(on_comments.get(c.id, []), member.user.id),
                    )
                    for c in comments.get(item.id, [])
                ),
                photo_version=photos.get(item.workout_id) if item.workout_id else None,
            )
            for item in items
            if item.actor_id in users
        )

    @staticmethod
    def _summary(reactions: list, reader_id: uuid.UUID) -> ReactionSummary:
        return FeedService._summary_of([(r.kind, r.user_id) for r in reactions], reader_id)

    @staticmethod
    def _summary_of(
        reactions: list[tuple[str, uuid.UUID]], reader_id: uuid.UUID
    ) -> ReactionSummary:
        counts = Counter(kind for kind, _ in reactions)
        mine = frozenset(kind for kind, user_id in reactions if user_id == reader_id)
        return ReactionSummary(counts=dict(counts), mine=mine)

    async def _inactive(self, member: Member) -> tuple[InactiveMember, ...]:
        """Other members whose last workout is `inactive_days` or more ago."""
        last = await self._workouts.last_finished_by_user(member.crew.id)
        now = self._now()
        prompts = []
        for user in await self._crews.members(member.crew.id):
            if user.id == member.user.id or user.id not in last:
                continue
            days = (now - last[user.id]).days
            if days >= self._inactive_days:
                prompts.append(InactiveMember(user=user, days=days))
        return tuple(sorted(prompts, key=lambda p: -p.days))
