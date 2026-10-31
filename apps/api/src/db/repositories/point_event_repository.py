"""SQL for point events."""

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.point_event import PointEvent


class PointEventRepository:
    """Appends to `point_events` and sums it. Rows are never edited."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add_all(self, events: list[PointEvent]) -> None:
        """Insert the events."""
        self._session.add_all(events)
        await self._session.flush()

    async def totals_by_user(
        self, crew_id: uuid.UUID, week_start: date | None = None
    ) -> dict[uuid.UUID, int]:
        """Points per member of the crew: all time, or for one crew-local week."""
        query = (
            select(PointEvent.user_id, func.sum(PointEvent.points))
            .where(PointEvent.crew_id == crew_id)
            .group_by(PointEvent.user_id)
        )
        if week_start is not None:
            query = query.where(PointEvent.week_start == week_start)
        result = await self._session.execute(query)
        return {user_id: int(total) for user_id, total in result.all()}
