"""SQL for duels."""

import uuid
from datetime import date, datetime

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.duel import Duel


class DuelRepository:
    """Reads and writes `duels`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, duel: Duel) -> Duel:
        """Insert a duel."""
        self._session.add(duel)
        await self._session.flush()
        return duel

    async def get(self, duel_id: uuid.UUID) -> Duel | None:
        """The duel, if any."""
        return await self._session.get(Duel, duel_id)

    async def save(self, duel: Duel) -> Duel:
        """Flush changes to a duel."""
        await self._session.flush()
        return duel

    async def involving(self, user_id: uuid.UUID, weeks: list[date]) -> list[Duel]:
        """The user's duels in these weeks, newest first."""
        result = await self._session.execute(
            select(Duel)
            .where(
                Duel.week_start.in_(weeks),
                or_(Duel.challenger_id == user_id, Duel.opponent_id == user_id),
            )
            .order_by(Duel.created_at.desc())
        )
        return list(result.scalars())

    async def open_between(self, a: uuid.UUID, b: uuid.UUID, week_start: date) -> Duel | None:
        """A pending or active duel between the two this week, if any."""
        result = await self._session.execute(
            select(Duel).where(
                Duel.week_start == week_start,
                Duel.status.in_(("pending", "active")),
                or_(
                    (Duel.challenger_id == a) & (Duel.opponent_id == b),
                    (Duel.challenger_id == b) & (Duel.opponent_id == a),
                ),
            )
        )
        return result.scalars().first()

    async def mark_settled(
        self, duel_id: uuid.UUID, winner_id: uuid.UUID | None, at: datetime
    ) -> bool:
        """Settle an active duel. False if another request settled it first (no double pay)."""
        result = await self._session.execute(
            update(Duel)
            .where(Duel.id == duel_id, Duel.status == "active")
            .values(status="settled", winner_id=winner_id, settled_at=at)
            .returning(Duel.id)
        )
        return result.scalar_one_or_none() is not None

    async def due_for_settlement(self, crew_id: uuid.UUID, before_week: date) -> list[Duel]:
        """Accepted duels from weeks that have ended."""
        result = await self._session.execute(
            select(Duel).where(
                Duel.crew_id == crew_id,
                Duel.status == "active",
                Duel.week_start < before_week,
            )
        )
        return list(result.scalars())
