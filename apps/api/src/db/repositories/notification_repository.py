"""SQL for notifications."""

import uuid
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.notification import Notification


class NotificationRepository:
    """Reads and writes `notifications`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add_all(self, notifications: list[Notification]) -> None:
        """Insert notifications."""
        self._session.add_all(notifications)
        await self._session.flush()

    async def latest(self, user_id: uuid.UUID, limit: int) -> list[Notification]:
        """The user's newest notifications."""
        result = await self._session.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc(), Notification.id)
            .limit(limit)
        )
        return list(result.scalars())

    async def unread_count(self, user_id: uuid.UUID) -> int:
        """How many notifications the user hasn't read."""
        count = await self._session.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        )
        return int(count or 0)

    async def mark_all_read(self, user_id: uuid.UUID, at: datetime) -> None:
        """Mark every unread notification of the user as read."""
        await self._session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
            .values(read_at=at)
        )

    async def sent_since(
        self, key: str, actor_id: uuid.UUID, user_id: uuid.UUID, since: datetime
    ) -> bool:
        """Whether `actor_id` already caused a `key` notification for `user_id` since then."""
        found = await self._session.scalar(
            select(Notification.id)
            .where(
                Notification.key == key,
                Notification.actor_id == actor_id,
                Notification.user_id == user_id,
                Notification.created_at >= since,
            )
            .limit(1)
        )
        return found is not None
