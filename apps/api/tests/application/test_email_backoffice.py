"""Email in the backoffice: settings, the digest going out once, and writing to people."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from clock import utc_now
from db.repositories.crew_repository import CrewRepository
from db.repositories.email_repository import EmailRepository
from db.tables.digest_send import DigestSend
from db.tables.point_event import PointEvent
from db.tables.user import User
from dependencies import build_email_service, get_email_sender, settings
from main import app
from services.crew_service import CrewService
from services.training_rules import week_start
from services.unsubscribe import unsubscribe_query
from tests.application.conftest import register_on

ADMIN = "boss@example.com"
ZONE = "America/Argentina/Buenos_Aires"


class FakeEmail:
    """Collects what would have gone out."""

    def __init__(self) -> None:
        self.sent = []
        self.works = True

    async def send(self, message) -> bool:
        self.sent.append(message)
        return self.works

    async def send_many(self, messages) -> int:
        self.sent.extend(messages)
        return len(messages) if self.works else 0


@pytest.fixture
def outbox(client):
    fake = FakeEmail()
    app.dependency_overrides[get_email_sender] = lambda: fake
    return fake


@pytest.fixture
async def admin(client, crew, monkeypatch):
    monkeypatch.setattr(settings, "admin_emails", frozenset({ADMIN}))
    return await register_on(client, ADMIN, "IRONRIDGE")


@pytest.fixture
async def maxo(other_client, crew):
    return await register_on(other_client, "maxo@example.com", "IRONRIDGE")


def digests(db_session, fake):
    return build_email_service(db_session, fake)


async def points_last_week(db_session, user_id, crew, points=500):
    """Points in the week that ended, so the crew has something to tell."""
    last_week = week_start(utc_now(), crew.time_zone) - timedelta(weeks=1)
    db_session.add(
        PointEvent(
            user_id=user_id,
            crew_id=crew.id,
            key="ln_history",
            vars={},
            points=points,
            week_start=last_week,
            created_at=utc_now() - timedelta(days=7),
        )
    )
    await db_session.flush()


def monday_morning():
    """A clock on the current week's Monday at 12:00 crew time, when a digest is due."""
    monday = week_start(utc_now(), ZONE)
    return lambda: datetime(monday.year, monday.month, monday.day, 15, 0, tzinfo=UTC)


# --- Settings ------------------------------------------------------------------------------


async def test_the_digest_starts_off_and_the_welcome_on(client, admin):
    body = (await client.get("/api/admin/email")).json()
    assert body["digest_enabled"] is False
    assert body["welcome_enabled"] is True
    assert body["digest_hour"] == 9
    assert body["configured"] is False


async def test_a_member_cant_see_or_change_them(other_client, admin, maxo):
    assert (await other_client.get("/api/admin/email")).status_code == 403
    response = await other_client.patch("/api/admin/email", json={"digest_enabled": True})
    assert response.status_code == 403
    message = {"subject": "x", "html": "<p>y</p>"}
    assert (await other_client.post("/api/admin/email/message", json=message)).status_code == 403


async def test_an_admin_changes_them_and_its_logged(client, admin):
    response = await client.patch(
        "/api/admin/email",
        json={"digest_enabled": True, "digest_hour": 7, "welcome_enabled": False},
    )
    body = response.json()
    assert (body["digest_enabled"], body["digest_hour"], body["welcome_enabled"]) == (
        True,
        7,
        False,
    )
    assert (await client.get("/api/admin/email")).json()["digest_hour"] == 7
    actions = (await client.get("/api/admin/actions")).json()
    assert actions[0]["action"] == "email_settings"


async def test_the_hour_has_to_be_an_hour(client, admin):
    response = await client.patch("/api/admin/email", json={"digest_hour": 24})
    assert response.status_code == 422


# --- The weekly digest ---------------------------------------------------------------------


async def turn_on(db_session):
    decided = await EmailRepository(db_session).settings()
    decided.digest_enabled = True
    await db_session.flush()


async def test_nothing_goes_out_while_its_off(client, admin, crew, db_session):
    fake = FakeEmail()
    await points_last_week(db_session, admin["id"], crew)
    service = digests(db_session, fake)
    service._now = monday_morning()  # pylint: disable=protected-access
    assert await service.send_due_digests() == 0
    assert fake.sent == []


async def test_it_goes_to_everyone_in_the_crew_once(client, admin, maxo, crew, db_session):
    await turn_on(db_session)
    await points_last_week(db_session, admin["id"], crew)
    fake = FakeEmail()
    service = digests(db_session, fake)
    service._now = monday_morning()  # pylint: disable=protected-access
    assert await service.send_due_digests() == 2
    assert sorted(m.to for m in fake.sent) == [ADMIN, "maxo@example.com"]
    # Every worker runs this every few minutes. Nobody gets it again.
    assert await service.send_due_digests() == 0
    assert len(fake.sent) == 2


async def test_it_isnt_due_before_the_hour(client, admin, crew, db_session):
    await turn_on(db_session)
    await points_last_week(db_session, admin["id"], crew)
    fake = FakeEmail()
    service = digests(db_session, fake)
    monday = week_start(utc_now(), ZONE)
    service._now = lambda: datetime(  # pylint: disable=protected-access
        monday.year, monday.month, monday.day, 11, 0, tzinfo=UTC
    )
    assert await service.send_due_digests() == 0


async def test_a_quiet_week_sends_nothing(client, admin, db_session):
    await turn_on(db_session)
    fake = FakeEmail()
    service = digests(db_session, fake)
    service._now = monday_morning()  # pylint: disable=protected-access
    assert await service.send_due_digests() == 0


async def test_someone_who_turned_it_off_doesnt_get_it(
    client, other_client, admin, maxo, crew, db_session
):
    await turn_on(db_session)
    await points_last_week(db_session, admin["id"], crew)
    await other_client.patch("/api/me", json={"email_updates": False})
    fake = FakeEmail()
    service = digests(db_session, fake)
    service._now = monday_morning()  # pylint: disable=protected-access
    await service.send_due_digests()
    assert [m.to for m in fake.sent] == [ADMIN]


async def test_a_failed_send_tries_again_next_time(client, admin, crew, db_session):
    await turn_on(db_session)
    await points_last_week(db_session, admin["id"], crew)
    fake = FakeEmail()
    fake.works = False
    service = digests(db_session, fake)
    service._now = monday_morning()  # pylint: disable=protected-access
    assert await service.send_due_digests() == 0
    assert (await db_session.execute(select(DigestSend))).first() is None
    fake.works = True
    assert await service.send_due_digests() == 1


async def test_its_links_stop_it(client, admin, crew, db_session):
    await turn_on(db_session)
    await points_last_week(db_session, admin["id"], crew)
    fake = FakeEmail()
    service = digests(db_session, fake)
    service._now = monday_morning()  # pylint: disable=protected-access
    await service.send_due_digests()
    assert "/unsubscribe?u=" in fake.sent[0].text
    assert dict(fake.sent[0].headers)["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"


async def test_an_admin_can_send_themselves_a_test(client, admin, crew, db_session, outbox):
    await points_last_week(db_session, admin["id"], crew)
    response = await client.post("/api/admin/email/test-digest")
    assert response.json() == {"sent": True}
    assert [m.to for m in outbox.sent] == [ADMIN]


async def test_a_test_with_nothing_to_tell_says_so(client, admin, outbox):
    response = await client.post("/api/admin/email/test-digest")
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "nothing_to_digest"


# --- The welcome email ---------------------------------------------------------------------


async def test_the_settings_row_survives_being_read_twice(db_session):
    first = await EmailRepository(db_session).settings()
    second = await EmailRepository(db_session).settings()
    assert first.id == second.id


# --- Writing to people ---------------------------------------------------------------------


def message(**extra):
    return {"subject": "Gym closed Friday", "html": "<p>See you Monday.</p>", **extra}


async def test_counting_who_it_reaches_sends_nothing(client, admin, maxo, outbox):
    response = await client.post("/api/admin/email/message", json=message(dry_run=True))
    assert response.json() == {"recipients": 2, "sent": 0}
    assert outbox.sent == []


async def test_it_goes_to_everyone(client, admin, maxo, outbox):
    response = await client.post("/api/admin/email/message", json=message())
    assert response.json() == {"recipients": 2, "sent": 2}
    assert sorted(m.to for m in outbox.sent) == [ADMIN, "maxo@example.com"]
    assert outbox.sent[0].subject == "Gym closed Friday"
    assert "See you Monday." in outbox.sent[0].text


async def test_it_goes_to_one_crew(client, other_client, admin, crew, outbox, db_session):
    other = await CrewService(CrewRepository(db_session)).create("Other", "UTC", "OTHERCREW")
    await register_on(other_client, "stranger@example.com", other.invite_code)
    body = message(crew_id=str(other.id))
    assert (await client.post("/api/admin/email/message", json=body)).json()["recipients"] == 1
    assert [m.to for m in outbox.sent] == ["stranger@example.com"]


async def test_it_goes_to_one_person(client, admin, maxo, outbox):
    body = message(email="MAXO@example.com")
    assert (await client.post("/api/admin/email/message", json=body)).json()["recipients"] == 1
    assert [m.to for m in outbox.sent] == ["maxo@example.com"]


async def test_an_unknown_person_or_crew_is_not_found(client, admin, outbox):
    body = message(email="nobody@example.com")
    assert (await client.post("/api/admin/email/message", json=body)).status_code == 404
    body = message(crew_id="00000000-0000-0000-0000-000000000000")
    assert (await client.post("/api/admin/email/message", json=body)).status_code == 404


async def test_someone_who_opted_out_isnt_written_to(client, other_client, admin, maxo, outbox):
    await other_client.patch("/api/me", json={"email_updates": False})
    assert (await client.post("/api/admin/email/message", json=message())).json()["recipients"] == 1
    body = message(email="maxo@example.com")
    assert (await client.post("/api/admin/email/message", json=body)).json()["recipients"] == 0


async def test_the_log_keeps_the_subject_not_who_or_what(client, admin, maxo, outbox):
    await client.post("/api/admin/email/message", json=message())
    action = (await client.get("/api/admin/actions")).json()[0]
    assert action["action"] == "email_sent"
    assert action["details"]["reason"] == "Gym closed Friday"
    assert "maxo@example.com" not in str(action)
    assert "See you Monday" not in str(action)


async def test_an_empty_message_is_refused(client, admin, outbox):
    body = {"subject": " ", "body": "x"}
    assert (await client.post("/api/admin/email/message", json=body)).status_code == 422


# --- Unsubscribing -------------------------------------------------------------------------


async def test_a_link_stops_updates_without_signing_in(
    client, other_client, admin, maxo, db_session
):
    query = unsubscribe_query(uuid.UUID(maxo["id"]), settings.session_secret)
    other_client.cookies.clear()
    assert (await other_client.post(f"/api/email/unsubscribe?{query}")).status_code == 204
    updates = await db_session.scalar(
        select(User.email_updates).where(User.email == "maxo@example.com")
    )
    assert updates is False


async def test_a_forged_link_does_nothing(client, maxo, db_session):
    url = f"/api/email/unsubscribe?u={maxo['id']}&t=forged"
    assert (await client.post(url)).status_code == 401
    updates = await db_session.scalar(
        select(User.email_updates).where(User.email == "maxo@example.com")
    )
    assert updates is True


async def test_a_member_can_turn_it_back_on(client, member):
    assert (await client.get("/api/me")).json()["email_updates"] is True
    assert (await client.patch("/api/me", json={"email_updates": False})).json()[
        "email_updates"
    ] is False
    assert (await client.patch("/api/me", json={"email_updates": True})).json()[
        "email_updates"
    ] is True


# --- Templates and rich messages ------------------------------------------------------------


async def test_every_email_gymbros_sends_can_be_started_from(client, admin):
    response = await client.get("/api/admin/email/templates?language=es")
    assert response.status_code == 200
    templates = {t["id"]: t for t in response.json()}
    assert set(templates) == {"announcement", "welcome", "digest", "invite"}
    assert {t["id"] for t in response.json() if t["live"]} == {"welcome", "digest"}
    assert "Hola {{name}}" in templates["welcome"]["html"]
    assert "{{unsubscribe_url}}" in templates["digest"]["html"]
    assert "{{unsubscribe_url}}" in templates["announcement"]["html"]


async def test_only_admins_get_the_templates_or_a_preview(other_client, crew):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    assert (await other_client.get("/api/admin/email/templates")).status_code == 403
    body = {"html": "<p>x</p>"}
    assert (await other_client.post("/api/admin/email/preview", json=body)).status_code == 403


async def test_a_preview_shows_it_as_it_will_arrive(client, admin, outbox):
    body = {"html": "<p>Hi {{name}}</p>"}
    response = await client.post("/api/admin/email/preview", json=body)
    assert "/email/banner.png" in response.json()["html"]
    assert "{{name}}" not in response.json()["html"]
    assert outbox.sent == []


async def test_a_whole_template_goes_out_with_each_persons_details(client, admin, maxo, outbox):
    templates = (await client.get("/api/admin/email/templates")).json()
    announcement = next(t for t in templates if t["id"] == "announcement")
    body = {"subject": announcement["subject"], "html": announcement["html"], "full_document": True}
    response = await client.post("/api/admin/email/message", json=body)
    assert response.json() == {"recipients": 2, "sent": 2}
    for sent in outbox.sent:
        assert "{{" not in sent.html
        assert dict(sent.headers)["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    mine = next(m for m in outbox.sent if m.to == "maxo@example.com")
    assert "Maxo" in mine.html


async def test_the_welcome_goes_out_as_each_persons_own(client, admin, maxo, outbox):
    response = await client.post("/api/admin/email/message", json={"template": "welcome"})
    assert response.json() == {"recipients": 2, "sent": 2}
    assert all(m.headers for m in outbox.sent)
    assert any("Hi Maxo" in m.text for m in outbox.sent)


async def test_the_digest_goes_only_to_people_in_a_crew(client, other_client, admin, maxo, outbox):
    await register_on(other_client, "solo@example.com")
    everyone = {"subject": "x", "html": "<p>y</p>", "dry_run": True}
    assert (await client.post("/api/admin/email/message", json=everyone)).json()["recipients"] == 3
    body = {"template": "digest", "dry_run": True}
    assert (await client.post("/api/admin/email/message", json=body)).json()["recipients"] == 2
    response = await client.post("/api/admin/email/message", json={"template": "digest"})
    assert response.json() == {"recipients": 2, "sent": 2}
    assert "solo@example.com" not in {m.to for m in outbox.sent}


async def test_a_message_is_one_thing_or_the_other(client, admin):
    send = lambda body: client.post("/api/admin/email/message", json=body)  # noqa: E731
    assert (await send({"subject": "x"})).status_code == 422
    assert (await send({"html": "<p>x</p>"})).status_code == 422
    assert (await send({"template": "welcome", "subject": "x"})).status_code == 422
    assert (await send({"template": "nope"})).status_code == 422
