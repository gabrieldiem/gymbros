"""Where a workout's photo is, for every model that shows a workout."""

import uuid

from pydantic import BaseModel


class PhotoResponse(BaseModel):
    """The workout's photo after a change."""

    photo_url: str | None


def photo_url(workout_id: uuid.UUID, version: int | None) -> str | None:
    """The photo's URL, which changes with each upload so it can be cached for good."""
    if version is None:
        return None
    return f"/api/workouts/{workout_id}/photo?v={version}"
