"""A place on the map, and what's needed to find one."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class Place:
    """Somewhere a search or a link pointed to."""

    name: str
    address: str | None
    lat: float
    lon: float


class PlaceSearch(Protocol):
    """Finding places by what they're called."""

    async def search(self, query: str, language: str) -> list[Place]:
        """The best matches. Raises PlacesUnavailable if the service can't answer."""


class MapLinkResolver(Protocol):
    """Following a short map link to the full one."""

    async def resolve(self, url: str) -> str | None:
        """Where the link ends up, if it stays on maps sites."""
