"""Gym request and response models."""

import uuid

from pydantic import BaseModel, Field, StringConstraints
from typing_extensions import Annotated

GymName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class GymLocationModel(BaseModel):
    """Where a gym is."""

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    address: str | None = Field(default=None, max_length=200)


class GymModel(BaseModel):
    """A place you train."""

    id: uuid.UUID
    name: str
    is_default: bool
    location: GymLocationModel | None = None


class AddGymRequest(BaseModel):
    """A new gym."""

    name: GymName
    location: GymLocationModel | None = None


class UpdateGymRequest(BaseModel):
    """A new name, making it the default, a new place on the map, or any of these. Leave
    `location` out to keep it; null takes the gym off the map."""

    name: GymName | None = None
    is_default: bool = False
    location: GymLocationModel | None = None


def to_gym_model(gym) -> GymModel:
    """A gym, on the map if it says where."""
    location = None
    if gym.lat is not None and gym.lon is not None:
        location = GymLocationModel(lat=gym.lat, lon=gym.lon, address=gym.address)
    return GymModel(id=gym.id, name=gym.name, is_default=gym.is_default, location=location)
