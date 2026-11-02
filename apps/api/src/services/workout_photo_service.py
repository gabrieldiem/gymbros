"""A photo of a whole workout: the member's to change, their crew's to see."""

import uuid
from collections.abc import Callable
from datetime import datetime

from db.repositories.workout_photo_repository import WorkoutPhotoRepository
from db.repositories.workout_repository import WorkoutRepository
from db.tables.workout import Workout
from db.tables.workout_photo import WorkoutPhoto
from services.errors import WorkoutNotFound, WorkoutPhotoNotFound
from services.images import MAX_PHOTO_BYTES, check_image
from services.member import Member


class WorkoutPhotoService:
    """Stores photos and decides who can see them."""

    def __init__(
        self,
        photos: WorkoutPhotoRepository,
        workouts: WorkoutRepository,
        now: Callable[[], datetime],
    ) -> None:
        self._photos = photos
        self._workouts = workouts
        self._now = now

    async def upload(self, member: Member, workout_id: uuid.UUID, data: bytes) -> Workout:
        """Add or replace the photo of your workout, in progress or finished."""
        workout = await self._own(member, workout_id)
        content_type = check_image(data, MAX_PHOTO_BYTES)
        now = self._now()
        await self._photos.store(
            WorkoutPhoto(
                workout_id=workout.id, image=data, content_type=content_type, updated_at=now
            )
        )
        # Past the last version even if two uploads land in the same second.
        workout.photo_version = max(int(now.timestamp()), (workout.photo_version or 0) + 1)
        return await self._workouts.save(workout)

    async def remove(self, member: Member, workout_id: uuid.UUID) -> Workout:
        """Remove the photo of your workout."""
        workout = await self._own(member, workout_id)
        await self._photos.delete(workout.id)
        workout.photo_version = None
        return await self._workouts.save(workout)

    async def view(self, member: Member, workout_id: uuid.UUID) -> WorkoutPhoto:
        """The photo, for anyone in the workout's crew. Anyone else gets not found."""
        workout = await self._workouts.get(workout_id)
        if workout is None or workout.crew_id != member.crew.id:
            raise WorkoutPhotoNotFound(str(workout_id))
        photo = await self._photos.get(workout.id)
        if photo is None:
            raise WorkoutPhotoNotFound(str(workout_id))
        return photo

    async def _own(self, member: Member, workout_id: uuid.UUID) -> Workout:
        workout = await self._workouts.get(workout_id)
        if workout is None or workout.user_id != member.user.id:
            raise WorkoutNotFound(str(workout_id))
        return workout
