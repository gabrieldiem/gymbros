"""SQL for steps."""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.step_entry import StepEntry


class StepRepository:
    """Stores what members log."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, entry: StepEntry) -> StepEntry:
        """Store it."""
        self._session.add(entry)
        await self._session.flush()
        return entry

    async def get(self, entry_id: uuid.UUID) -> StepEntry | None:
        """An entry, if there is one."""
        return await self._session.get(StepEntry, entry_id)

    async def delete(self, entry: StepEntry) -> None:
        """Remove it. Its point events go with it."""
        await self._session.delete(entry)
        await self._session.flush()

    async def overlapping(self, user_id: uuid.UUID, start: date, end: date) -> list[StepEntry]:
        """The member's entries touching any of these days."""
        result = await self._session.scalars(
            select(StepEntry).where(
                StepEntry.user_id == user_id,
                StepEntry.start_date <= end,
                StepEntry.end_date >= start,
            )
        )
        return list(result)

    async def in_crew(self, crew_id: uuid.UUID) -> list[StepEntry]:
        """Everything logged in a crew, oldest first."""
        result = await self._session.scalars(
            select(StepEntry)
            .where(StepEntry.crew_id == crew_id)
            .order_by(StepEntry.start_date, StepEntry.created_at)
        )
        return list(result)
