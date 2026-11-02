"""Following a short maps link, one redirect at a time, only as far as maps sites go."""

from urllib.parse import parse_qs, urljoin, urlparse

import httpx

from services.map_links import is_followable

_MAX_HOPS = 4
_TIMEOUT_SECONDS = 8
_CONSENT_HOST = "consent.google.com"


class MapLinkClient:
    """Implements MapLinkResolver. `transport` lets tests replace the network."""

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._transport = transport

    async def resolve(self, url: str) -> str | None:
        """Where the link ends up, or None if it leaves maps sites or doesn't get anywhere. Only
        headers are read, and redirects are never followed automatically."""
        current = url
        try:
            async with httpx.AsyncClient(
                transport=self._transport, timeout=_TIMEOUT_SECONDS, follow_redirects=False
            ) as client:
                for _ in range(_MAX_HOPS):
                    current = _past_consent(current)
                    if not is_followable(current):
                        return None
                    async with client.stream("GET", current) as response:
                        location = response.headers.get("location")
                    if not location:
                        return current
                    current = urljoin(current, location)
        except httpx.HTTPError:
            return None
        return None


def _past_consent(url: str) -> str:
    """In Europe Google asks for cookie consent first, with the real link inside its own."""
    parts = urlparse(url)
    if parts.hostname != _CONSENT_HOST:
        return url
    return parse_qs(parts.query).get("continue", [url])[0]
