"""Reading where a place is from the link someone copied out of a maps app."""

import httpx
import pytest

from clients.map_link_client import MapLinkClient
from services.map_links import is_followable, parse_map_link

BA = (-34.5892488, -58.4100666)


@pytest.mark.parametrize(
    "url",
    [
        "https://www.google.com/maps/place/Smart+Fit/@-34.5892488,-58.4100666,17z/data=!3m1!4b1",
        "https://www.google.com/maps/@-34.5892488,-58.4100666,15z",
        "https://www.google.com.ar/maps/place/Gym/@-1.0,-1.0,17z/data=!3d-34.5892488!4d-58.4100666",
        "https://www.google.com/maps?q=-34.5892488,-58.4100666",
        "https://maps.google.com/?ll=-34.5892488,-58.4100666&z=15",
        "https://www.google.com/maps/search/?api=1&query=-34.5892488%2C-58.4100666",
        "https://www.google.com/maps/dir/?api=1&destination=-34.5892488,-58.4100666",
        "https://www.openstreetmap.org/?mlat=-34.5892488&mlon=-58.4100666#map=19/-34.58/-58.41",
        "https://www.openstreetmap.org/#map=19/-34.5892488/-58.4100666",
    ],
)
def test_the_coordinates_come_out_of_every_kind_of_link(url):
    parsed = parse_map_link(url)
    assert parsed is not None
    assert (parsed.lat, parsed.lon) == BA


def test_a_pin_wins_over_where_the_map_was_looking():
    url = "https://www.google.com/maps/place/G/@1.0,2.0,17z/data=!3d-34.5!4d-58.4"
    parsed = parse_map_link(url)
    assert parsed is not None
    assert (parsed.lat, parsed.lon) == (-34.5, -58.4)


def test_the_place_name_comes_along():
    url = "https://www.google.com/maps/place/Smart+Fit+Palermo/@-34.5,-58.4,17z"
    parsed = parse_map_link(url)
    assert parsed is not None
    assert parsed.name == "Smart Fit Palermo"


def test_a_link_with_only_words_says_what_to_search_for():
    parsed = parse_map_link("https://www.google.com/maps?q=Smart+Fit+Palermo")
    assert parsed is not None
    assert parsed.lat is None
    assert parsed.text == "Smart Fit Palermo"


@pytest.mark.parametrize(
    "url",
    [
        "not a link",
        "https://example.com/@-34.5,-58.4,17z",
        "https://evil.com/maps?q=-34.5,-58.4",
        "https://www.google.com/maps/@-340.5,-58.4,17z",
        "javascript:alert(1)",
    ],
)
def test_anything_else_says_nothing(url):
    assert parse_map_link(url) is None


@pytest.mark.parametrize(
    ("url", "ok"),
    [
        ("https://maps.app.goo.gl/abc", True),
        ("https://goo.gl/maps/abc", True),
        ("https://www.google.com/maps/place/x", True),
        ("https://www.google.com.ar/maps", True),
        ("http://maps.app.goo.gl/abc", False),
        ("https://169.254.169.254/latest", False),
        ("https://localhost/maps", False),
        ("https://google.com.evil.com/maps", False),
        ("https://evil.com/maps.app.goo.gl", False),
    ],
)
def test_only_maps_links_are_ever_followed(url, ok):
    assert is_followable(url) is ok


def _redirects(*locations):
    steps = list(locations)
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        if not steps:
            return httpx.Response(200, text="done")
        return httpx.Response(302, headers={"Location": steps.pop(0)})

    return MapLinkClient(httpx.MockTransport(handler)), seen


async def test_a_short_link_is_followed_to_where_it_goes():
    target = "https://www.google.com/maps/place/Gym/@-34.5,-58.4,17z"
    client, _ = _redirects(target)
    assert await client.resolve("https://maps.app.goo.gl/abc") == target


async def test_a_redirect_somewhere_else_isnt_followed():
    client, seen = _redirects("https://169.254.169.254/latest/meta-data")
    assert await client.resolve("https://maps.app.goo.gl/abc") is None
    assert seen == ["https://maps.app.goo.gl/abc"]


async def test_a_link_outside_maps_isnt_even_requested():
    client, seen = _redirects()
    assert await client.resolve("https://evil.example/abc") is None
    assert seen == []


async def test_redirects_dont_go_on_forever():
    hop = "https://goo.gl/maps/next"
    client, seen = _redirects(*[hop] * 20)
    assert await client.resolve(hop) is None
    assert len(seen) <= 5


async def test_a_network_error_says_nothing():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    client = MapLinkClient(httpx.MockTransport(handler))
    assert await client.resolve("https://maps.app.goo.gl/abc") is None
