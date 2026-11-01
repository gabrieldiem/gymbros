"""Concurrent finishes in one crew: the bonus lock pays the crew quest once.

The rest of the suite runs every test inside one rolled-back transaction, which can't show two
transactions racing. These tests commit through two real sessions and delete what they created.
"""

# pylint: disable=redefined-outer-name

import asyncio
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import timedelta

import pytest
from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from clock import utc_now
from dependencies import build_bonus_service, engine
from db.tables.crew import Crew
from db.tables.membership import Membership
from db.tables.point_event import PointEvent
from db.tables.user import User
from db.tables.workout import Workout
from services.member import Member
from services.quest_service import CREW_QUEST_KEY
from services.training_rules import week_start

TIME_ZONE = "America/Argentina/Buenos_Aires"
Sessions = async_sessionmaker(engine, expire_on_commit=False)


@dataclass(frozen=True, slots=True)
class Racers:
    """Two members of one crew, each with a finished workout, and the totals before them."""

    members: tuple[Member, Member]
    workouts: tuple[Workout, Workout]
    before: dict[uuid.UUID, int]


def _user(tag: str, name: str) -> User:
    return User(
        email=f"{name.lower()}-{tag}@lock.test",
        password_hash="x",
        display_name=name,
        initials=name[:2].upper(),
        color="teal",
        language="en",
    )


async def _seed(session: AsyncSession) -> Racers:
    """A crew whose points this week (4,100) already reach the crew quest goal (4,000)."""
    tag = uuid.uuid4().hex[:8]
    crew = Crew(name="Lock Test", time_zone=TIME_ZONE, invite_code=tag.upper())
    users = (_user(tag, "Gabi"), _user(tag, "Maxo"))
    session.add_all([crew, *users])
    await session.flush()
    now, week = utc_now(), week_start(utc_now(), TIME_ZONE)
    session.add_all([Membership(user_id=u.id, crew_id=crew.id) for u in users])
    session.add_all(
        [
            PointEvent(
                user_id=u.id,
                crew_id=crew.id,
                key="ln_sets",
                vars={},
                points=points,
                week_start=week,
                created_at=now,
            )
            for u, points in zip(users, (2100, 2000))
        ]
    )
    workouts = tuple(
        Workout(
            user_id=u.id,
            crew_id=crew.id,
            name="Push day",
            started_at=now - timedelta(hours=1),
            finished_at=now,
            week_start=week,
            volume_kg=1000.0,
            points=0,
        )
        for u in users
    )
    session.add_all(workouts)
    await session.commit()
    members = (Member(users[0], crew), Member(users[1], crew))
    return Racers(members, workouts, {users[0].id: 2100, users[1].id: 2000})


@pytest.fixture
async def racers(migrated_database) -> AsyncIterator[Racers]:
    """Committed crew data, deleted afterwards (cascades remove events, workouts, feed)."""
    del migrated_database
    async with Sessions() as session:
        seeded = await _seed(session)
    try:
        yield seeded
    finally:
        async with Sessions() as session:
            await session.execute(delete(User).where(User.id.in_(seeded.before)))
            await session.execute(delete(Crew).where(Crew.id == seeded.members[0].crew.id))
            await session.commit()


async def _waiting_advisory_locks() -> int:
    async with Sessions() as session:
        result = await session.execute(
            text("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted")
        )
        return int(result.scalar_one())


async def _wait_until_blocked(timeout: float = 5.0) -> bool:
    """True once another transaction is queued behind the advisory lock."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        if await _waiting_advisory_locks() > 0:
            return True
        await asyncio.sleep(0.05)
    return False


async def _finish(session: AsyncSession, racers: Racers, index: int) -> list[str]:
    service = build_bonus_service(session)
    member, workout = racers.members[index], racers.workouts[index]
    return [item.key for item in await service.after_workout(member, workout, racers.before)]


async def _crew_quest_events(crew_id: uuid.UUID) -> int:
    async with Sessions() as session:
        query = select(func.count()).where(
            PointEvent.crew_id == crew_id, PointEvent.key == CREW_QUEST_KEY
        )
        return int((await session.execute(query)).scalar_one())


async def test_concurrent_finishes_pay_the_crew_quest_once(racers: Racers):
    """The second finish waits for the first to commit, then sees the quest already claimed."""
    crew_id = racers.members[0].crew.id
    first, second = Sessions(), Sessions()
    try:
        assert CREW_QUEST_KEY in await _finish(first, racers, 0)
        blocked = asyncio.create_task(_finish(second, racers, 1))
        assert await _wait_until_blocked(), "the second finish didn't wait for the lock"
        assert not blocked.done()
        await first.commit()
        assert CREW_QUEST_KEY not in await asyncio.wait_for(blocked, timeout=5)
        await second.commit()
    finally:
        await first.close()
        await second.close()
    # One event each: the claimer's own line item and the bonus paid to the other member.
    assert await _crew_quest_events(crew_id) == 2


async def test_finishes_in_other_crews_do_not_wait(racers: Racers):
    """The lock is per crew and week: a finish holding it doesn't block an unrelated key."""
    first = Sessions()
    try:
        await _finish(first, racers, 0)
        other_crew = f"bonus:{uuid.uuid4()}:{week_start(utc_now(), TIME_ZONE).isoformat()}"
        async with Sessions() as other:
            lock = text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))")
            await asyncio.wait_for(other.execute(lock, {"key": other_crew}), timeout=5)
            await other.rollback()
    finally:
        await first.close()
