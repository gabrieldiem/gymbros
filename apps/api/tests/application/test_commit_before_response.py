"""A request's writes are committed before its response is sent, so the next read sees them."""

from dependencies import get_session
from main import app


async def test_the_session_closes_before_the_response_starts(db_session):
    order = []

    async def recording_session():
        try:
            yield db_session
        finally:
            order.append("session closed")

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        if message["type"] == "http.response.start":
            order.append("response started")

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "path": "/api/crews/invite/NOPE",
        "raw_path": b"/api/crews/invite/NOPE",
        "query_string": b"",
        "root_path": "",
        "headers": [],
        "server": ("test", 80),
        "client": ("test", 1),
        "scheme": "http",
    }
    original = app.dependency_overrides.get(get_session)
    app.dependency_overrides[get_session] = recording_session
    try:
        await app(scope, receive, send)
    finally:
        if original is None:
            app.dependency_overrides.pop(get_session, None)
        else:
            app.dependency_overrides[get_session] = original
    assert order == ["session closed", "response started"]


async def test_a_write_can_be_read_straight_away(client, member):
    await client.post("/api/me/gyms", json={"name": "Smart Fit"})
    assert [g["name"] for g in (await client.get("/api/me/gyms")).json()] == ["Smart Fit"]
