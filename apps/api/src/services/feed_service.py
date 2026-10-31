"""The Crew feed: pages of items with reactions and comments, nudge prompts, react, comment."""

import uuid
from collections import Counter
from collections.abc import Callable
from datetime import datetime

from db.repositories.crew_repository import CrewRepository
from db.repositories.feed_repository import FeedRepository
from db.repositories.user_repository import UserRepository
from db.repositories.workout_repository import WorkoutRepository
from db.tables.comment import Comment
from db.tables.feed_item import FeedItem
from services.errors import FeedItemNotFound, OwnFeedItem
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
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._feed = feed
        self._users = users
        self._crews = crews
        self._workouts = workouts
        self._notifier = notifier
        self._inactive_days = inactive_days
        self._now = now

    async def page(self, member: Member, before: datetime | None, limit: int) -> FeedPage:
        """Newest first. The first page also carries the nudge prompts."""
        items = await self._feed.page(member.crew.id, before, limit)
        entries = await self._entries(member, items)
        inactive = await self._inactive(member) if before is None else ()
        next_before = items[-1].created_at if len(items) == limit else None
        return FeedPage(entries=entries, inactive=inactive, next_before=next_before)

    async def react(self, member: Member, item_id: uuid.UUID, kind: str) -> ReactionSummary:
        """Toggle a reaction on someone else's item; the owner hears about new ones."""
        item = await self._item_in_crew(member, item_id)
        if item.actor_id == member.user.id:
            raise OwnFeedItem(str(item_id))
        added = await self._feed.toggle_reaction(item.id, member.user.id, kind)
        if added:
            await self._notifier.send(
                [item.actor_id],
                member.user.id,
                "n_react",
                {"name": member.user.display_name, "kind": kind, "item": item.kind},
                "/crew",
            )
        return self._summary(await self._feed.reactions([item.id]), member.user.id)

    async def comment(
        self, member: Member, item_id: uuid.UUID, body: str | None, quick_key: str | None
    ) -> CommentView:
        """Add a comment (text or a quick reply); the item's owner is notified."""
        item = await self._item_in_crew(member, item_id)
        comment = await self._feed.add_comment(
            Comment(
                feed_item_id=item.id,
                user_id=member.user.id,
                body=body,
                quick_key=quick_key,
                created_at=self._now(),
            )
        )
        await self._notifier.send(
            [item.actor_id],
            member.user.id,
            "n_comment",
            {"name": member.user.display_name, "item": item.kind},
            "/crew",
        )
        return CommentView(comment=comment, author=member.user)

    async def _item_in_crew(self, member: Member, item_id: uuid.UUID) -> FeedItem:
        item = await self._feed.get(item_id)
        if item is None or item.crew_id != member.crew.id:
            raise FeedItemNotFound(str(item_id))
        return item

    async def _entries(self, member: Member, items: list[FeedItem]) -> tuple[FeedEntry, ...]:
        ids = [item.id for item in items]
        reactions = await self._feed.reactions(ids)
        comments = await self._feed.comments(ids)
        authors = {item.actor_id for item in items} | {
            c.user_id for thread in comments.values() for c in thread
        }
        users = await self._users.get_many(authors)
        return tuple(
            FeedEntry(
                item=item,
                actor=users[item.actor_id],
                reactions=self._summary(
                    [r for r in reactions if r.feed_item_id == item.id], member.user.id
                ),
                comments=tuple(CommentView(c, users[c.user_id]) for c in comments.get(item.id, [])),
            )
            for item in items
            if item.actor_id in users
        )

    @staticmethod
    def _summary(reactions: list, reader_id: uuid.UUID) -> ReactionSummary:
        counts = Counter(r.kind for r in reactions)
        mine = frozenset(r.kind for r in reactions if r.user_id == reader_id)
        return ReactionSummary(counts={"fist": counts["fist"], "fire": counts["fire"]}, mine=mine)

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
