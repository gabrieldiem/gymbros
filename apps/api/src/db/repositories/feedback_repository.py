"""SQL for feedback."""

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.feedback import Feedback
from db.tables.user import User


class FeedbackRepository:
    """Reads and writes `feedback`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, feedback: Feedback) -> None:
        """Insert a message."""
        self._session.add(feedback)
        await self._session.flush()

    async def get(self, feedback_id: uuid.UUID) -> Feedback | None:
        """The message, if any."""
        return await self._session.get(Feedback, feedback_id)

    async def save(self) -> None:
        """Flush changes to a loaded message."""
        await self._session.flush()

    async def count_since(self, user_id: uuid.UUID, since: datetime) -> int:
        """How many messages the user has sent since then."""
        count = await self._session.scalar(
            select(func.count())
            .select_from(Feedback)
            .where(Feedback.user_id == user_id, Feedback.created_at >= since)
        )
        return int(count or 0)

    async def latest(self, limit: int) -> list[tuple[Feedback, User]]:
        """The newest messages with who sent them."""
        result = await self._session.execute(
            select(Feedback, User)
            .join(User, User.id == Feedback.user_id)
            .order_by(Feedback.created_at.desc(), Feedback.id)
            .limit(limit)
        )
        return [(row[0], row[1]) for row in result.all()]
