"""SQL for point events."""

from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.point_event import PointEvent


class PointEventRepository:
    """Appends to `point_events`. Rows are never edited."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add_all(self, events: list[PointEvent]) -> None:
        """Insert the events."""
        self._session.add_all(events)
        await self._session.flush()
