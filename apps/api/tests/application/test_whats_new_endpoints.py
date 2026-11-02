"""What's new over HTTP: the list, and one quiet notification per release."""

from datetime import UTC, datetime

from sqlalchemy import select, update

from db.tables.notification import Notification
from db.tables.user import User
from services.whats_new import load_whats_new


async def joined_long_ago(db_session, email="gabi@example.com"):
    await db_session.execute(
        update(User).where(User.email == email).values(created_at=datetime(2026, 1, 1, tzinfo=UTC))
    )
    await db_session.flush()
    db_session.expire_all()


async def whats_new_rows(db_session):
    result = await db_session.execute(select(Notification).where(Notification.key == "n_whats_new"))
    return list(result.scalars())


async def test_the_list_needs_a_session(client):
    assert (await client.get("/api/whats-new")).status_code == 401


async def test_the_list_is_every_entry(client, member):
    body = (await client.get("/api/whats-new")).json()
    assert [e["id"] for e in body] == [e.id for e in load_whats_new()]
    assert set(body[0]) == {"id", "date", "link"}


async def test_a_new_account_gets_no_notification(client, member, db_session):
    await client.get("/api/notifications")
    assert await whats_new_rows(db_session) == []


async def test_everything_new_arrives_as_one_notification(client, member, db_session):
    await joined_long_ago(db_session)
    body = (await client.get("/api/notifications")).json()
    assert body["unread"] == 1
    item = body["items"][0]
    assert item["key"] == "n_whats_new"
    assert item["link"] == "/whats-new"
    assert item["actor"] is None
    entries = load_whats_new()
    assert item["vars"] == {"n": len(entries), "feature": entries[0].id}


async def test_it_only_arrives_once(client, member, db_session):
    await joined_long_ago(db_session)
    await client.get("/api/notifications")
    await client.get("/api/notifications")
    await client.post("/api/notifications/read")
    await client.get("/api/notifications")
    assert len(await whats_new_rows(db_session)) == 1
