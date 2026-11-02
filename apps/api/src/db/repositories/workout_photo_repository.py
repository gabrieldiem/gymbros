"""SQL for workout photos."""

import uuid

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.workout_photo import WorkoutPhoto


class WorkoutPhotoRepository:
    """Reads and writes `workout_photos`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, workout_id: uuid.UUID) -> WorkoutPhoto | None:
        """The workout's photo, if any."""
        return await self._session.get(WorkoutPhoto, workout_id)

    async def store(self, photo: WorkoutPhoto) -> None:
        """Insert or replace the workout's photo."""
        values = {
            "workout_id": photo.workout_id,
            "image": photo.image,
            "content_type": photo.content_type,
            "updated_at": photo.updated_at,
        }
        await self._session.execute(
            insert(WorkoutPhoto)
            .values(**values)
            .on_conflict_do_update(index_elements=["workout_id"], set_=values)
        )

    async def delete(self, workout_id: uuid.UUID) -> None:
        """Remove the workout's photo, if any."""
        photo = await self.get(workout_id)
        if photo is not None:
            await self._session.delete(photo)
            await self._session.flush()
