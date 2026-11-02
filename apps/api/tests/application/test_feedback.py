"""Members send feedback from the app and admins read it in the backoffice."""

import pytest

from tests.application.conftest import register_on

ADMIN = "boss@example.com"


async def send(client, body="Add a dark mode", kind="idea"):
    return await client.post("/api/feedback", json={"kind": kind, "body": body})


@pytest.fixture
async def admin(client, crew, monkeypatch):
    from dependencies import settings

    monkeypatch.setattr(settings, "admin_emails", frozenset({ADMIN}))
    return await register_on(client, ADMIN, "IRONRIDGE")


async def test_it_needs_a_session(client):
    assert (await send(client)).status_code == 401


async def test_a_member_sends_it_and_an_admin_reads_it(client, other_client, admin):
    await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    assert (await send(other_client, "  The map is slow  ", "bug")).status_code == 201
    items = (await client.get("/api/admin/feedback")).json()
    assert len(items) == 1
    assert items[0]["body"] == "The map is slow"
    assert items[0]["kind"] == "bug"
    assert items[0]["email"] == "maxo@example.com"
    assert items[0]["display_name"] == "Maxo"
    assert items[0]["handled"] is False


async def test_a_member_cant_read_it(other_client, admin):
    await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    assert (await other_client.get("/api/admin/feedback")).status_code == 403


async def test_newest_comes_first(client, other_client, admin):
    await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    await send(other_client, "First")
    await send(other_client, "Second")
    items = (await client.get("/api/admin/feedback")).json()
    assert [i["body"] for i in items] == ["Second", "First"]


async def test_an_admin_marks_it_handled_and_back_and_its_logged(client, other_client, admin):
    await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    await send(other_client)
    item = (await client.get("/api/admin/feedback")).json()[0]
    url = f"/api/admin/feedback/{item['id']}"
    assert (await client.patch(url, json={"handled": True})).json()["handled"] is True
    assert (await client.get("/api/admin/feedback")).json()[0]["handled"] is True
    assert (await client.patch(url, json={"handled": False})).json()["handled"] is False
    actions = (await client.get("/api/admin/actions")).json()
    assert actions[0]["action"] == "feedback_reopened"
    assert actions[1]["action"] == "feedback_handled"


async def test_an_unknown_item_is_not_found(client, admin):
    url = "/api/admin/feedback/00000000-0000-0000-0000-000000000000"
    response = await client.patch(url, json={"handled": True})
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "feedback_not_found"


async def test_empty_too_long_or_unknown_kinds_are_refused(client, member):
    assert (await send(client, "   ")).status_code == 422
    assert (await send(client, "x" * 2001)).status_code == 422
    assert (await send(client, "Fine", "rant")).status_code == 422


async def test_there_is_a_daily_limit(client, member):
    for _ in range(10):
        assert (await send(client)).status_code == 201
    over = await send(client)
    assert over.status_code == 429
    assert over.json()["detail"]["code"] == "too_much_feedback"


async def test_deleting_an_account_deletes_its_feedback(client, other_client, admin):
    await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    await send(other_client)
    await other_client.post("/api/me/delete", json={"confirm_email": "maxo@example.com"})
    assert (await client.get("/api/admin/feedback")).json() == []
