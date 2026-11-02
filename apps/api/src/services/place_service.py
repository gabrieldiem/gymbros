"""Finding a place for a gym, by searching or from a pasted maps link."""

from services.errors import MapLinkNotUnderstood
from services.map_links import is_short_link, parse_map_link
from services.places import MapLinkResolver, Place, PlaceSearch


class PlaceService:
    """Turns what someone typed or pasted into places on the map."""

    def __init__(self, search: PlaceSearch, resolver: MapLinkResolver) -> None:
        self._search = search
        self._resolver = resolver

    async def search(self, query: str, language: str) -> list[Place]:
        """The best matches for what someone typed."""
        return await self._search.search(query, language)

    async def from_link(self, url: str, language: str) -> Place:
        """The place in a pasted link. Words without coordinates are searched for."""
        target = url.strip()
        if is_short_link(target):
            target = await self._resolver.resolve(target) or ""
        parsed = parse_map_link(target)
        if parsed is None:
            raise MapLinkNotUnderstood(url)
        if parsed.lat is not None and parsed.lon is not None:
            return Place(parsed.name or "", None, parsed.lat, parsed.lon)
        found = await self._search.search(parsed.text or "", language)
        if not found:
            raise MapLinkNotUnderstood(url)
        return found[0]
