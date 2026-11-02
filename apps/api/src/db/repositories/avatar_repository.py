"""SQL for uploaded profile pictures."""

import uuid

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.avatar import Avatar


class AvatarRepository:
    """Reads and writes `avatars`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, user_id: uuid.UUID) -> Avatar | None:
        """The user's picture, if any."""
        return await self._session.get(Avatar, user_id)

    async def store(self, avatar: Avatar) -> None:
        """Insert or replace the user's picture."""
        values = {
            "user_id": avatar.user_id,
            "image": avatar.image,
            "content_type": avatar.content_type,
            "updated_at": avatar.updated_at,
        }
        await self._session.execute(
            insert(Avatar)
            .values(**values)
            .on_conflict_do_update(index_elements=["user_id"], set_=values)
        )

    async def delete(self, user_id: uuid.UUID) -> None:
        """Remove the user's picture, if any."""
        avatar = await self.get(user_id)
        if avatar is not None:
            await self._session.delete(avatar)
            await self._session.flush()
