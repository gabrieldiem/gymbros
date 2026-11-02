"""SQL for gyms."""

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.gym import Gym


class GymRepository:
    """Reads and writes `gyms`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def for_user(self, user_id: uuid.UUID) -> list[Gym]:
        """The user's gyms, oldest first."""
        result = await self._session.execute(
            select(Gym).where(Gym.user_id == user_id).order_by(Gym.created_at, Gym.id)
        )
        return list(result.scalars())

    async def get(self, gym_id: uuid.UUID) -> Gym | None:
        """The gym, if any."""
        return await self._session.get(Gym, gym_id)

    async def default_name(self, user_id: uuid.UUID) -> str | None:
        """The name of the user's default gym, if any."""
        return await self._session.scalar(
            select(Gym.name).where(Gym.user_id == user_id, Gym.is_default.is_(True))
        )

    async def name_taken(self, user_id: uuid.UUID, name: str, except_id: uuid.UUID | None) -> bool:
        """Whether another of the user's gyms has this name, whatever the case."""
        query = (
            select(func.count())
            .select_from(Gym)
            .where(Gym.user_id == user_id, func.lower(Gym.name) == name.lower())
        )
        if except_id is not None:
            query = query.where(Gym.id != except_id)
        return bool(await self._session.scalar(query))

    async def add(self, gym: Gym) -> Gym:
        """Insert a gym."""
        self._session.add(gym)
        await self._session.flush()
        return gym

    async def clear_default(self, user_id: uuid.UUID) -> None:
        """No gym of this user is the default for now."""
        await self._session.execute(
            update(Gym)
            .where(Gym.user_id == user_id, Gym.is_default.is_(True))
            .values(is_default=False)
        )

    async def save(self, gym: Gym) -> Gym:
        """Flush changes to a loaded gym."""
        await self._session.flush()
        await self._session.refresh(gym)
        return gym

    async def delete(self, gym: Gym) -> None:
        """Remove a gym."""
        await self._session.delete(gym)
        await self._session.flush()
