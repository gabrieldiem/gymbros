"""SQL for feed items, reactions and comments."""

import uuid
from collections import defaultdict
from datetime import datetime

from sqlalchemy import delete, func, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.comment import Comment
from db.tables.feed_item import FeedItem
from db.tables.reaction import Reaction


class FeedRepository:
    """Reads and writes `feed_items`, `reactions` and `comments`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, item: FeedItem) -> FeedItem:
        """Insert a feed item."""
        self._session.add(item)
        await self._session.flush()
        return item

    async def get(self, item_id: uuid.UUID) -> FeedItem | None:
        """The feed item, if any."""
        return await self._session.get(FeedItem, item_id)

    async def page(
        self, crew_id: uuid.UUID, before: tuple[datetime, uuid.UUID] | None, limit: int
    ) -> list[FeedItem]:
        """Newest items first; after the (created_at, id) cursor when given (no ties skipped)."""
        query = select(FeedItem).where(FeedItem.crew_id == crew_id)
        if before is not None:
            query = query.where(tuple_(FeedItem.created_at, FeedItem.id) < before)
        result = await self._session.execute(
            query.order_by(FeedItem.created_at.desc(), FeedItem.id.desc()).limit(limit)
        )
        return list(result.scalars())

    async def reactions(self, item_ids: list[uuid.UUID]) -> list[Reaction]:
        """Every reaction on these items."""
        if not item_ids:
            return []
        result = await self._session.execute(
            select(Reaction).where(Reaction.feed_item_id.in_(item_ids))
        )
        return list(result.scalars())

    async def toggle_reaction(self, item_id: uuid.UUID, user_id: uuid.UUID, kind: str) -> bool:
        """Add the reaction, or remove it if present. Returns True when it was added."""
        existing = await self._session.get(Reaction, (item_id, user_id, kind))
        if existing is not None:
            await self._session.execute(
                delete(Reaction).where(
                    Reaction.feed_item_id == item_id,
                    Reaction.user_id == user_id,
                    Reaction.kind == kind,
                )
            )
            return False
        self._session.add(Reaction(feed_item_id=item_id, user_id=user_id, kind=kind))
        await self._session.flush()
        return True

    async def comments(self, item_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[Comment]]:
        """Comments per item, oldest first."""
        if not item_ids:
            return {}
        result = await self._session.execute(
            select(Comment)
            .where(Comment.feed_item_id.in_(item_ids))
            .order_by(Comment.created_at, Comment.id)
        )
        grouped: dict[uuid.UUID, list[Comment]] = defaultdict(list)
        for comment in result.scalars():
            grouped[comment.feed_item_id].append(comment)
        return dict(grouped)

    async def add_comment(self, comment: Comment) -> Comment:
        """Insert a comment."""
        self._session.add(comment)
        await self._session.flush()
        return comment

    async def count_by_user(self, user_id: uuid.UUID) -> tuple[int, int]:
        """(reactions given, comments written) by the user. Used by badges."""
        reactions = await self._session.scalar(
            select(func.count()).select_from(Reaction).where(Reaction.user_id == user_id)
        )
        comments = await self._session.scalar(
            select(func.count()).select_from(Comment).where(Comment.user_id == user_id)
        )
        return int(reactions or 0), int(comments or 0)
