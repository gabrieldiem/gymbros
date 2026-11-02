"""Searching places with OpenStreetMap's free Nominatim service, no key or account needed.

Its usage policy asks for at most one request a second, an identifying User-Agent, caching and no
search-as-you-type: https://operations.osmfoundation.org/policies/nominatim/. The app searches when
someone presses Search, and this client waits and caches. Going through the server also means the
service never sees who is searching.
"""

import asyncio
import time
from collections import OrderedDict

import httpx

from services.errors import PlacesUnavailable
from services.places import Place

SEARCH_URL = "https://nominatim.openstreetmap.org/search"
_TIMEOUT_SECONDS = 8
_MIN_INTERVAL_SECONDS = 1.1
_RESULTS = 5
_CACHE_SIZE = 256


class NominatimClient:
    """Implements PlaceSearch. One per process, so the wait and the cache are shared."""

    def __init__(self, public_url: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._agent = f"gymbros/1.0 (+{public_url})"
        self._transport = transport
        self._lock = asyncio.Lock()
        self._last_request = 0.0
        self._cache: OrderedDict[tuple[str, str], list[Place]] = OrderedDict()

    async def search(self, query: str, language: str) -> list[Place]:
        """The best matches. Raises PlacesUnavailable if the service can't answer."""
        key = (" ".join(query.lower().split()), language)
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        async with self._lock:
            await self._wait_for_turn()
            places = await self._ask(query, language)
        self._cache[key] = places
        if len(self._cache) > _CACHE_SIZE:
            self._cache.popitem(last=False)
        return places

    async def _wait_for_turn(self) -> None:
        wait = self._last_request + _MIN_INTERVAL_SECONDS - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        self._last_request = time.monotonic()

    async def _ask(self, query: str, language: str) -> list[Place]:
        try:
            async with httpx.AsyncClient(
                transport=self._transport, timeout=_TIMEOUT_SECONDS
            ) as client:
                response = await client.get(
                    SEARCH_URL,
                    params={"q": query, "format": "jsonv2", "limit": _RESULTS},
                    headers={"User-Agent": self._agent, "Accept-Language": language},
                )
            response.raise_for_status()
            return [_place(row) for row in response.json()]
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            raise PlacesUnavailable(type(error).__name__) from error


def _place(row: dict) -> Place:
    address = str(row["display_name"])
    return Place(
        name=str(row.get("name") or address.split(",", maxsplit=1)[0]),
        address=address,
        lat=float(row["lat"]),
        lon=float(row["lon"]),
    )
