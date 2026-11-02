"""Reading where a place is from a link copied out of a maps app. No maps API is involved: the
coordinates are in the link itself."""

import re
from dataclasses import dataclass
from urllib.parse import parse_qs, unquote_plus, urlparse

_GOOGLE_HOST = re.compile(r"^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$")
_SHORT_HOSTS = ("maps.app.goo.gl", "goo.gl", "g.co")
_OSM_HOST = re.compile(r"^(www\.)?openstreetmap\.org$")
_NUMBER = r"(-?\d{1,3}(?:\.\d+)?)"
_PIN = re.compile(rf"!3d{_NUMBER}!4d{_NUMBER}")
_VIEW = re.compile(rf"/@{_NUMBER},{_NUMBER}")
_PAIR = re.compile(rf"^{_NUMBER},\s*{_NUMBER}$")
_OSM_VIEW = re.compile(rf"map=\d+/{_NUMBER}/{_NUMBER}")
_PLACE_NAME = re.compile(r"/maps/place/([^/@]+)")
_COORDINATE_PARAMS = ("q", "query", "ll", "center", "destination", "daddr", "sll")


@dataclass(frozen=True, slots=True)
class ParsedLink:
    """What a link says: where, what it's called, or only words to search for."""

    lat: float | None = None
    lon: float | None = None
    name: str | None = None
    text: str | None = None


def _host(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower()
    except ValueError:
        return ""


def _is_maps_host(host: str) -> bool:
    return bool(_GOOGLE_HOST.match(host) or _OSM_HOST.match(host))


def is_short_link(url: str) -> bool:
    """A link that only says where to go next."""
    return _host(url) in _SHORT_HOSTS


def is_followable(url: str) -> bool:
    """Whether the server may request this: https, and only maps sites. Everything else stays
    untouched, so a pasted link can't make the server call something inside its own network."""
    if not url.startswith("https://"):
        return False
    host = _host(url)
    return host in _SHORT_HOSTS or bool(_GOOGLE_HOST.match(host))


def _valid(lat: float, lon: float) -> bool:
    return -90 <= lat <= 90 and -180 <= lon <= 180


def _found(match: re.Match[str] | None) -> tuple[float, float] | None:
    if match is None:
        return None
    lat, lon = float(match.group(1)), float(match.group(2))
    return (lat, lon) if _valid(lat, lon) else None


def _from_params(params: dict[str, list[str]]) -> tuple[float, float] | None:
    if "mlat" in params and "mlon" in params:
        try:
            lat, lon = float(params["mlat"][0]), float(params["mlon"][0])
        except ValueError:
            return None
        return (lat, lon) if _valid(lat, lon) else None
    for key in _COORDINATE_PARAMS:
        for value in params.get(key, []):
            pair = _found(_PAIR.match(value))
            if pair:
                return pair
    return None


def _place_name(path: str) -> str | None:
    match = _PLACE_NAME.search(path)
    return unquote_plus(match.group(1)).strip() or None if match else None


def parse_map_link(url: str) -> ParsedLink | None:
    """What this link says, or None if it isn't a maps link or says nothing useful. A pin in the
    link wins over where the map happened to be looking."""
    try:
        parts = urlparse(url.strip())
    except ValueError:
        return None
    if parts.scheme not in ("http", "https") or not _is_maps_host(_host(url.strip())):
        return None
    params = parse_qs(parts.query)
    place = _place_name(parts.path)
    whole = parts.path + "?" + parts.query
    spot = (
        _found(_PIN.search(whole))
        or _from_params(params)
        or _found(_OSM_VIEW.search(parts.fragment))
        or _found(_VIEW.search(parts.path))
    )
    if spot:
        return ParsedLink(lat=spot[0], lon=spot[1], name=place)
    words = next((v for key in ("q", "query", "destination") for v in params.get(key, [])), None)
    text = words or place
    return ParsedLink(text=text.strip()) if text and text.strip() else None
