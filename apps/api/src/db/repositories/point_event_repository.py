"""SQL for point events."""

import uuid
from datetime import date, datetime

from sqlalchemy import delete, func, select, text

from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.point_event import PointEvent


class PointEventRepository:
    """Appends to `point_events` and sums it. Rows are never edited: changing a workout replaces
    its rows whole."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def lock(self, key: str) -> None:
        """Serialize work on `key` until this transaction ends (Postgres advisory lock)."""
        await self._session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": key}
        )

    async def for_workouts(self, workout_ids: list[uuid.UUID]) -> list[PointEvent]:
        """What these workouts paid, in the order it was paid."""
        if not workout_ids:
            return []
        result = await self._session.execute(
            select(PointEvent).where(PointEvent.workout_id.in_(workout_ids)).order_by(PointEvent.id)
        )
        return list(result.scalars())

    async def for_workout(self, workout_id: uuid.UUID) -> list[PointEvent]:
        """What a workout paid, in the order it was paid."""
        result = await self._session.execute(
            select(PointEvent).where(PointEvent.workout_id == workout_id).order_by(PointEvent.id)
        )
        return list(result.scalars())

    async def delete_for_workout(self, workout_id: uuid.UUID) -> None:
        """Remove what a workout paid, to replace it."""
        await self._session.execute(delete(PointEvent).where(PointEvent.workout_id == workout_id))

    async def logged_times(self, workout_ids: list[uuid.UUID]) -> dict[uuid.UUID, datetime]:
        """When each workout's points first arrived, which is when it was logged."""
        if not workout_ids:
            return {}
        result = await self._session.execute(
            select(PointEvent.workout_id, func.min(PointEvent.created_at))
            .where(PointEvent.workout_id.in_(workout_ids))
            .group_by(PointEvent.workout_id)
        )
        return {workout_id: at for workout_id, at in result.all() if workout_id is not None}

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

    async def totals_before_week(
        self, crew_id: uuid.UUID, week_start: date
    ) -> dict[uuid.UUID, int]:
        """All-time points per member counting only weeks before `week_start`."""
        result = await self._session.execute(
            select(PointEvent.user_id, func.sum(PointEvent.points))
            .where(PointEvent.crew_id == crew_id, PointEvent.week_start < week_start)
            .group_by(PointEvent.user_id)
        )
        return {user_id: int(total) for user_id, total in result.all()}

    async def user_has(self, user_id: uuid.UUID, week_start: date, key: str, **match: str) -> bool:
        """Whether the user already earned `key` this week (optionally with matching vars)."""
        query = select(PointEvent.vars).where(
            PointEvent.user_id == user_id,
            PointEvent.week_start == week_start,
            PointEvent.key == key,
        )
        rows = (await self._session.execute(query)).scalars().all()
        return any(all(row.get(k) == v for k, v in match.items()) for row in rows)

    async def crew_has(self, crew_id: uuid.UUID, week_start: date, key: str) -> bool:
        """Whether anyone in the crew earned `key` this week."""
        found = await self._session.scalar(
            select(PointEvent.id)
            .where(
                PointEvent.crew_id == crew_id,
                PointEvent.week_start == week_start,
                PointEvent.key == key,
            )
            .limit(1)
        )
        return found is not None

    async def count_key(self, user_id: uuid.UUID, key: str) -> int:
        """How many `key` events the user has, ever."""
        count = await self._session.scalar(
            select(func.count())
            .select_from(PointEvent)
            .where(PointEvent.user_id == user_id, PointEvent.key == key)
        )
        return int(count or 0)

    async def week_events(self, crew_id: uuid.UUID, week_start: date, key: str) -> list[PointEvent]:
        """Every `key` event in the crew for that week."""
        result = await self._session.execute(
            select(PointEvent).where(
                PointEvent.crew_id == crew_id,
                PointEvent.week_start == week_start,
                PointEvent.key == key,
            )
        )
        return list(result.scalars())

    async def week_points_excluding(
        self, user_id: uuid.UUID, week_start: date, excluded_key: str
    ) -> int:
        """The user's points in a week, leaving out one key (duel winnings)."""
        total = await self._session.scalar(
            select(func.sum(PointEvent.points)).where(
                PointEvent.user_id == user_id,
                PointEvent.week_start == week_start,
                PointEvent.key != excluded_key,
            )
        )
        return int(total or 0)
