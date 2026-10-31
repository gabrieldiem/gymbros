"""SQL for users."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.user import User


class UserRepository:
    """Reads and writes `users`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, user_id: uuid.UUID) -> User | None:
        """The user with this id, if any."""
        return await self._session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        """The user with this (lower-cased) email, if any."""
        result = await self._session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def add(self, user: User) -> User:
        """Insert a user and flush so its id is assigned."""
        self._session.add(user)
        await self._session.flush()
        return user

    async def save(self, user: User) -> User:
        """Flush pending changes to a loaded user."""
        await self._session.flush()
        return user

    async def delete(self, user: User) -> None:
        """Remove a user; their sessions, membership, workouts and points cascade."""
        await self._session.delete(user)
        await self._session.flush()

    async def get_many(self, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, User]:
        """Users by id."""
        if not user_ids:
            return {}
        result = await self._session.execute(select(User).where(User.id.in_(user_ids)))
        return {user.id: user for user in result.scalars()}
