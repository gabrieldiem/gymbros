"""Gym request and response models."""

import uuid

from pydantic import BaseModel, StringConstraints
from typing_extensions import Annotated

GymName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class GymModel(BaseModel):
    """A place you train."""

    id: uuid.UUID
    name: str
    is_default: bool


class AddGymRequest(BaseModel):
    """A new gym."""

    name: GymName


class UpdateGymRequest(BaseModel):
    """A new name, making it the default, or both."""

    name: GymName | None = None
    is_default: bool = False
