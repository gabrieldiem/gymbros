"""Places on the map."""

from pydantic import BaseModel, Field


class PlaceModel(BaseModel):
    """Somewhere a search or a link pointed to."""

    name: str
    address: str | None
    lat: float
    lon: float


class FromLinkRequest(BaseModel):
    """A link copied from a maps app."""

    url: str = Field(min_length=1, max_length=2000)
