"""SQL for unlocked badges."""

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.membership import Membership
from db.tables.user_badge import UserBadge


class BadgeRepository:
    """Reads and writes `user_badges`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def unlocked(self, user_id: uuid.UUID) -> dict[str, datetime]:
        """Badge id → when the user unlocked it."""
        result = await self._session.execute(
            select(UserBadge.badge_id, UserBadge.unlocked_at).where(UserBadge.user_id == user_id)
        )
        return dict(result.all())

    async def add(self, user_id: uuid.UUID, badge_id: str, at: datetime) -> None:
        """Record an unlock."""
        self._session.add(UserBadge(user_id=user_id, badge_id=badge_id, unlocked_at=at))
        await self._session.flush()

    async def crew_counts(self, crew_id: uuid.UUID) -> dict[str, int]:
        """How many crew members have each badge."""
        result = await self._session.execute(
            select(UserBadge.badge_id, func.count())
            .join(Membership, Membership.user_id == UserBadge.user_id)
            .where(Membership.crew_id == crew_id)
            .group_by(UserBadge.badge_id)
        )
        return {badge_id: int(count) for badge_id, count in result.all()}
