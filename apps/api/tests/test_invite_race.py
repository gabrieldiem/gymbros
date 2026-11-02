"""Two people taking the last use of an invite at once: only one gets in. Real committed sessions,
because the rolled-back transaction the rest of the suite uses can't show two transactions."""

# pylint: disable=redefined-outer-name

import asyncio
import uuid
from collections.abc import AsyncIterator

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker

from clock import utc_now
from db.repositories.crew_repository import CrewRepository
from db.tables.crew import Crew
from dependencies import engine

Sessions = async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
async def crew(migrated_database) -> AsyncIterator[uuid.UUID]:
    """A crew with one use left, committed, and deleted afterwards."""
    del migrated_database
    async with Sessions() as session:
        row = Crew(
            name="Race",
            time_zone="UTC",
            invite_code=uuid.uuid4().hex[:12].upper(),
            invite_max_uses=1,
        )
        session.add(row)
        await session.commit()
        crew_id = row.id
    try:
        yield crew_id
    finally:
        async with Sessions() as session:
            await session.execute(delete(Crew).where(Crew.id == crew_id))
            await session.commit()


async def test_only_one_person_gets_the_last_use(crew):
    first, second = Sessions(), Sessions()
    try:
        assert await CrewRepository(first).consume_invite(crew, utc_now()) is True
        # The second waits on the row until the first commits, then sees no uses left.
        waiting = asyncio.create_task(CrewRepository(second).consume_invite(crew, utc_now()))
        await asyncio.sleep(0.2)
        assert not waiting.done()
        await first.commit()
        assert await asyncio.wait_for(waiting, timeout=5) is False
    finally:
        await first.close()
        await second.close()
