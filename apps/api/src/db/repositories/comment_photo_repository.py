"""SQL for comment photos."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.comment_photo import CommentPhoto


class CommentPhotoRepository:
    """Stores the image of a comment."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, photo: CommentPhoto) -> None:
        """Store it."""
        self._session.add(photo)
        await self._session.flush()

    async def get(self, comment_id: uuid.UUID) -> CommentPhoto | None:
        """The image of a comment, if it has one."""
        return await self._session.get(CommentPhoto, comment_id)
