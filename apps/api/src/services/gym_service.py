"""A member's gyms. The first is the default, and there's always a default while any is left."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from db.repositories.gym_repository import GymRepository
from db.tables.gym import Gym
from services.errors import GymNameTaken, GymNotFound, TooManyGyms

MAX_GYMS = 10


@dataclass(frozen=True, slots=True)
class GymLocation:
    """Where a gym is."""

    lat: float
    lon: float
    address: str | None = None


def _place(gym: Gym, location: GymLocation | None) -> None:
    gym.lat = location.lat if location else None
    gym.lon = location.lon if location else None
    gym.address = location.address if location else None


class GymService:
    """Lists and changes the gyms of the signed-in user."""

    def __init__(self, gyms: GymRepository, now: Callable[[], datetime]) -> None:
        self._gyms = gyms
        self._now = now

    async def list(self, user_id: uuid.UUID) -> list[Gym]:
        """The user's gyms, oldest first."""
        return await self._gyms.for_user(user_id)

    async def default_name(self, user_id: uuid.UUID) -> str | None:
        """Where a workout starts unless the member says otherwise."""
        return await self._gyms.default_name(user_id)

    async def add(self, user_id: uuid.UUID, name: str, location: GymLocation | None = None) -> Gym:
        """Add a gym, on the map if it says where. The first one becomes the default."""
        existing = await self._gyms.for_user(user_id)
        if len(existing) >= MAX_GYMS:
            raise TooManyGyms(str(user_id))
        await self._check_name(user_id, name, None)
        gym = Gym(user_id=user_id, name=name, is_default=not existing, created_at=self._now())
        _place(gym, location)
        return await self._gyms.add(gym)

    async def update(
        self,
        user_id: uuid.UUID,
        gym_id: uuid.UUID,
        name: str | None,
        make_default: bool,
        change_location: bool = False,
        location: GymLocation | None = None,
    ) -> Gym:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        """Rename a gym, make it the default, move it on the map, or any of these."""
        gym = await self._own(user_id, gym_id)
        if name is not None:
            await self._check_name(user_id, name, gym.id)
            gym.name = name
        if make_default and not gym.is_default:
            await self._gyms.clear_default(user_id)
            gym.is_default = True
        if change_location:
            _place(gym, location)
        return await self._gyms.save(gym)

    async def delete(self, user_id: uuid.UUID, gym_id: uuid.UUID) -> None:
        """Delete a gym. If it was the default, the oldest one left takes over."""
        gym = await self._own(user_id, gym_id)
        was_default = gym.is_default
        await self._gyms.delete(gym)
        if not was_default:
            return
        left = await self._gyms.for_user(user_id)
        if left:
            left[0].is_default = True
            await self._gyms.save(left[0])

    async def _own(self, user_id: uuid.UUID, gym_id: uuid.UUID) -> Gym:
        gym = await self._gyms.get(gym_id)
        if gym is None or gym.user_id != user_id:
            raise GymNotFound(str(gym_id))
        return gym

    async def _check_name(self, user_id: uuid.UUID, name: str, except_id: uuid.UUID | None) -> None:
        if await self._gyms.name_taken(user_id, name, except_id):
            raise GymNameTaken(name)
