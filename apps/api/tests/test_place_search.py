"""Searching OpenStreetMap's Nominatim, within what its usage policy asks of a free service."""

import httpx
import pytest

from clients.nominatim_client import NominatimClient
from services.errors import PlacesUnavailable

ROW = {
    "name": "Tolón",
    "display_name": "Tolón, 3200, Avenida Santa Fe, Buenos Aires, Argentina",
    "lat": "-34.5892488",
    "lon": "-58.4100666",
}


def _client(handler, **kwargs):
    return NominatimClient("https://gymbros.example", httpx.MockTransport(handler), **kwargs)


async def test_a_search_returns_places():
    client = _client(lambda _: httpx.Response(200, json=[ROW]))
    places = await client.search("Santa Fe 3200", "es")
    assert len(places) == 1
    assert places[0].name == "Tolón"
    assert places[0].address == ROW["display_name"]
    assert (places[0].lat, places[0].lon) == (-34.5892488, -58.4100666)


async def test_a_place_without_a_name_uses_the_start_of_its_address():
    row = {**ROW, "name": ""}
    client = _client(lambda _: httpx.Response(200, json=[row]))
    assert (await client.search("x", "es"))[0].name == "Tolón"


async def test_it_says_who_it_is_and_only_sends_the_search():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=[])

    await _client(handler).search("Santa Fe 3200", "es")
    request = seen[0]
    assert "gymbros" in request.headers["user-agent"]
    assert request.headers["accept-language"] == "es"
    assert request.url.params["q"] == "Santa Fe 3200"
    assert request.url.params["format"] == "jsonv2"
    assert "cookie" not in request.headers


async def test_the_same_search_isnt_asked_twice():
    calls = []

    def handler(_request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(200, json=[ROW])

    client = _client(handler)
    await client.search("Santa Fe 3200", "es")
    await client.search("  santa fe 3200 ", "es")
    assert len(calls) == 1


async def test_it_waits_between_requests(monkeypatch):
    waits = []

    async def fake_sleep(seconds):
        waits.append(seconds)

    monkeypatch.setattr("clients.nominatim_client.asyncio.sleep", fake_sleep)
    client = _client(lambda _: httpx.Response(200, json=[]))
    await client.search("one", "es")
    await client.search("two", "es")
    assert waits and waits[0] > 0.5


@pytest.mark.parametrize("response", [httpx.Response(503), httpx.Response(200, text="nope")])
async def test_a_bad_answer_says_its_unavailable(response):
    client = _client(lambda _: response)
    with pytest.raises(PlacesUnavailable):
        await client.search("x", "es")


async def test_a_network_error_says_its_unavailable():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    with pytest.raises(PlacesUnavailable):
        await _client(handler).search("x", "es")
