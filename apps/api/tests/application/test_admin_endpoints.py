"""The backoffice: who gets in, and that every change works and is audited."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from dependencies import get_email_sender
from main import app
from tests.application.conftest import register_on

ADMIN = "boss@example.com"
ENDPOINTS = [
    ("GET", "/api/admin/overview"),
    ("GET", "/api/admin/crews"),
    ("POST", "/api/admin/crews"),
    ("PATCH", "/api/admin/crews/00000000-0000-0000-0000-000000000000"),
    ("POST", "/api/admin/crews/00000000-0000-0000-0000-000000000000/invite-code"),
    ("GET", "/api/admin/members"),
    ("POST", "/api/admin/members/00000000-0000-0000-0000-000000000000/points"),
    ("DELETE", "/api/admin/members/00000000-0000-0000-0000-000000000000/crew"),
    ("DELETE", "/api/admin/members/00000000-0000-0000-0000-000000000000"),
    ("GET", "/api/admin/actions"),
    ("POST", "/api/admin/crews/00000000-0000-0000-0000-000000000000/invites"),
]


@pytest.fixture
async def admin(client, crew):
    """The admin, signed in on `client`, in the crew."""
    return await register_on(client, ADMIN, "IRONRIDGE")


@pytest.fixture
async def maxo(other_client, crew):
    """A regular member, signed in on `other_client`."""
    return await register_on(other_client, "maxo@example.com", "IRONRIDGE")


async def _actions(client):
    return (await client.get("/api/admin/actions")).json()


# --- Who gets in ----------------------------------------------------------------------------


@pytest.mark.parametrize(("method", "path"), ENDPOINTS)
async def test_every_endpoint_needs_a_session(client, method, path):
    response = await client.request(method, path)
    assert response.status_code == 401


@pytest.mark.parametrize(("method", "path"), ENDPOINTS)
async def test_every_endpoint_refuses_regular_members(other_client, maxo, method, path):
    response = await other_client.request(method, path)
    assert response.status_code == 403
    assert response.json() == {"detail": {"code": "admin_required"}}


async def test_me_says_who_is_an_admin(client, other_client, admin, maxo):
    assert (await client.get("/api/me")).json()["is_admin"] is True
    assert (await other_client.get("/api/me")).json()["is_admin"] is False


async def test_admin_emails_ignore_case(other_client, crew):
    await register_on(other_client, "second@example.com", "IRONRIDGE")
    assert (await other_client.get("/api/admin/overview")).status_code == 200


async def test_nobody_can_make_themselves_an_admin(other_client, maxo):
    await other_client.patch("/api/me", json={"is_admin": True, "email": ADMIN})
    assert (await other_client.get("/api/me")).json()["is_admin"] is False
    assert (await other_client.get("/api/admin/overview")).status_code == 403


# --- Reading --------------------------------------------------------------------------------


async def test_overview_counts_accounts_and_crews(client, admin, maxo):
    body = (await client.get("/api/admin/overview")).json()
    assert body["users"] == 2
    assert body["crews"] == 1
    assert body["users_without_crew"] == 0
    assert body["workouts"] == 0


async def test_crews_list_members_and_invite_codes(client, admin, maxo):
    row = (await client.get("/api/admin/crews")).json()[0]
    assert (row["name"], row["invite_code"], row["members"]) == ("Iron Ridge", "IRONRIDGE", 2)


async def test_members_can_be_searched_by_name_or_email(client, admin, maxo):
    assert len((await client.get("/api/admin/members")).json()) == 2
    found = (await client.get("/api/admin/members", params={"search": "MAXO"})).json()
    assert [m["email"] for m in found] == ["maxo@example.com"]
    assert found[0]["crew_name"] == "Iron Ridge"
    assert found[0]["is_admin"] is False


async def test_a_search_treats_wildcards_as_text(client, admin, maxo):
    assert (await client.get("/api/admin/members", params={"search": "%"})).json() == []


# --- Crews ----------------------------------------------------------------------------------


async def test_creating_a_crew_gives_a_code_that_works(client, other_client, admin):
    created = await client.post(
        "/api/admin/crews", json={"name": " ATUS ", "time_zone": "America/Argentina/Buenos_Aires"}
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "ATUS"
    joined = await register_on(other_client, "new@example.com", body["invite_code"])
    assert joined["crew"]["name"] == "ATUS"
    assert (await _actions(client))[0]["action"] == "crew_created"


async def test_an_unknown_time_zone_is_refused(client, admin):
    response = await client.post("/api/admin/crews", json={"name": "X", "time_zone": "Mars/Base"})
    assert response.status_code == 422


async def test_updating_a_crew(client, admin, crew):
    response = await client.patch(
        f"/api/admin/crews/{crew.id}", json={"name": "ATUS", "time_zone": "Europe/Madrid"}
    )
    assert response.status_code == 200
    assert (response.json()["name"], response.json()["time_zone"]) == ("ATUS", "Europe/Madrid")


async def test_an_unknown_crew_is_a_404(client, admin):
    response = await client.patch(
        "/api/admin/crews/00000000-0000-0000-0000-000000000000", json={"name": "X"}
    )
    assert response.status_code == 404
    assert response.json() == {"detail": {"code": "crew_not_found"}}


async def test_rotating_the_invite_code_retires_the_old_one(client, other_client, admin, crew):
    rotated = (await client.post(f"/api/admin/crews/{crew.id}/invite-code")).json()
    assert rotated["invite_code"] != "IRONRIDGE"
    await register_on(other_client, "late@example.com")
    assert (
        await other_client.post("/api/crews/join", json={"invite_code": "IRONRIDGE"})
    ).status_code == 404
    assert (
        await other_client.post("/api/crews/join", json={"invite_code": rotated["invite_code"]})
    ).status_code == 200


# --- Members --------------------------------------------------------------------------------


async def test_adjusting_points_moves_the_standings(client, other_client, admin, maxo):
    response = await client.post(
        f"/api/admin/members/{maxo['id']}/points",
        json={"points": 300, "reason": "Logged on paper"},
    )
    assert response.status_code == 204
    standings = (await other_client.get("/api/climb")).json()["standings"]
    assert next(s for s in standings if s["user_id"] == maxo["id"])["points"] == 300
    log = (await _actions(client))[0]
    assert log["action"] == "points_adjusted"
    assert log["target"] == maxo["id"]
    assert log["admin_email"] == ADMIN
    assert log["details"] == {"points": 300, "reason": "Logged on paper"}


async def test_points_can_also_be_removed(client, other_client, admin, maxo):
    url = f"/api/admin/members/{maxo['id']}/points"
    await client.post(url, json={"points": 500, "reason": "Typo fix"})
    await client.post(url, json={"points": -200, "reason": "Typo fix"})
    standings = (await other_client.get("/api/climb")).json()["standings"]
    assert next(s for s in standings if s["user_id"] == maxo["id"])["points"] == 300


@pytest.mark.parametrize(
    "body",
    [
        {"points": 100, "reason": "x"},
        {"points": 100, "reason": "   "},
        {"points": 5001, "reason": "Too many"},
        {"points": 100},
    ],
)
async def test_an_adjustment_needs_a_reason_and_a_sane_amount(client, admin, maxo, body):
    response = await client.post(f"/api/admin/members/{maxo['id']}/points", json=body)
    assert response.status_code == 422


async def test_points_need_a_crew(client, other_client, admin):
    loner = await register_on(other_client, "loner@example.com")
    response = await client.post(
        f"/api/admin/members/{loner['id']}/points", json={"points": 10, "reason": "Nope"}
    )
    assert response.status_code == 409
    assert response.json() == {"detail": {"code": "member_has_no_crew"}}


async def test_removing_from_a_crew_keeps_the_account(client, other_client, admin, maxo):
    assert (await client.delete(f"/api/admin/members/{maxo['id']}/crew")).status_code == 204
    me = (await other_client.get("/api/me")).json()
    assert me["crew"] is None
    assert me["email"] == "maxo@example.com"


async def test_deleting_an_account_removes_it_and_ends_its_session(
    client, other_client, admin, maxo
):
    assert (await client.delete(f"/api/admin/members/{maxo['id']}")).status_code == 204
    assert (await other_client.get("/api/me")).status_code == 401
    emails = [m["email"] for m in (await client.get("/api/admin/members")).json()]
    assert "maxo@example.com" not in emails


async def test_the_audit_log_keeps_no_personal_data_of_a_deleted_account(client, admin, maxo):
    await client.delete(f"/api/admin/members/{maxo['id']}")
    log = (await _actions(client))[0]
    assert log["action"] == "account_deleted"
    assert "maxo" not in str(log).lower()


async def test_an_admin_cannot_delete_themselves_here(client, admin):
    response = await client.delete(f"/api/admin/members/{admin['id']}")
    assert response.status_code == 409
    assert response.json() == {"detail": {"code": "cannot_delete_self"}}


async def test_an_unknown_member_is_a_404(client, admin):
    response = await client.delete("/api/admin/members/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


# --- Deleting your own account ----------------------------------------------------------------


async def test_you_can_delete_your_own_account(other_client, maxo):
    response = await other_client.post(
        "/api/me/delete", json={"confirm_email": "MAXO@example.com "}
    )
    assert response.status_code == 204
    assert "gymbros_session=" in response.headers["set-cookie"]
    assert (await other_client.get("/api/me")).status_code == 401


async def test_deleting_your_account_needs_your_email(other_client, maxo):
    response = await other_client.post(
        "/api/me/delete", json={"confirm_email": "someone@example.com"}
    )
    assert response.status_code == 422
    assert response.json() == {"detail": {"code": "delete_not_confirmed"}}
    assert (await other_client.get("/api/me")).status_code == 200


async def test_deleting_needs_a_session(client):
    response = await client.post("/api/me/delete", json={"confirm_email": "a@b.co"})
    assert response.status_code == 401


# --- Invite codes: custom, limited, emailed ---------------------------------------------------


class FakeEmail:
    """Collects invites instead of sending them. Set `works` to False to simulate Resend failing."""

    def __init__(self) -> None:
        self.sent = []
        self.works = True

    async def send(self, message) -> bool:
        self.sent.append(message)
        return self.works


@pytest.fixture
def outbox(client):
    fake = FakeEmail()
    app.dependency_overrides[get_email_sender] = lambda: fake
    return fake


def _in(hours: int) -> str:
    return (datetime.now(UTC) + timedelta(hours=hours)).isoformat()


async def _join(http_client, email: str, code: str):
    await register_on(http_client, email)
    return await http_client.post("/api/crews/join", json={"invite_code": code})


async def test_a_crew_can_have_a_custom_invite_code(client, other_client, admin, crew):
    response = await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_code": "atus-2026"})
    assert response.status_code == 200
    assert response.json()["invite_code"] == "ATUS2026"
    assert (await _join(other_client, "new@example.com", "atus2026")).status_code == 200


async def test_a_new_crew_can_start_with_a_custom_code_and_limits(client, admin):
    response = await client.post(
        "/api/admin/crews",
        json={
            "name": "ATUS",
            "time_zone": "America/Argentina/Buenos_Aires",
            "invite_code": "SUMMIT",
            "invite_max_uses": 5,
            "invite_expires_at": _in(48),
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert (body["invite_code"], body["invite_max_uses"]) == ("SUMMIT", 5)
    assert body["invite_status"] == "active"


async def test_a_custom_code_must_be_free(client, admin, crew):
    other = await client.post(
        "/api/admin/crews", json={"name": "Other", "time_zone": "UTC", "invite_code": "TAKEN1"}
    )
    assert other.status_code == 201
    response = await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_code": "taken-1"})
    assert response.status_code == 409
    assert response.json() == {"detail": {"code": "invite_code_taken"}}


async def test_setting_a_crews_own_code_again_is_fine(client, admin, crew):
    response = await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_code": "ironridge"})
    assert response.status_code == 200


@pytest.mark.parametrize("code", ["abc", "THIRTEENCHARS", "ñandú", "!!!!"])
async def test_a_custom_code_must_be_4_to_12_letters_and_digits(client, admin, crew, code):
    response = await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_code": code})
    assert response.status_code == 422
    assert response.json() == {"detail": {"code": "invite_code_invalid"}}


async def test_max_uses_stops_new_joins_and_counts_them(client, other_client, admin, crew):
    # The admin's own join already counted once.
    await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_max_uses": 2})
    assert (await _join(other_client, "second@member.com", "IRONRIDGE")).status_code == 200
    row = (await client.get("/api/admin/crews")).json()[0]
    assert (row["invite_uses"], row["invite_status"]) == (2, "used_up")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as third:
        response = await _join(third, "third@member.com", "IRONRIDGE")
    assert response.status_code == 410
    assert response.json() == {"detail": {"code": "invite_code_used_up"}}


async def test_an_expired_code_stops_joins(client, other_client, admin, crew, db_session):
    crew.invite_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.flush()
    response = await _join(other_client, "late@member.com", "IRONRIDGE")
    assert response.status_code == 410
    assert response.json() == {"detail": {"code": "invite_code_expired"}}
    assert (await client.get("/api/admin/crews")).json()[0]["invite_status"] == "expired"
    invite = await other_client.get("/api/crews/invite/IRONRIDGE")
    assert invite.status_code == 410


async def test_a_future_expiry_lets_people_join(client, other_client, admin, crew):
    response = await client.patch(
        f"/api/admin/crews/{crew.id}", json={"invite_expires_at": _in(24)}
    )
    assert response.status_code == 200
    assert (await _join(other_client, "soon@member.com", "IRONRIDGE")).status_code == 200


async def test_an_expiry_in_the_past_is_refused(client, admin, crew):
    response = await client.patch(
        f"/api/admin/crews/{crew.id}", json={"invite_expires_at": _in(-1)}
    )
    assert response.status_code == 422
    assert response.json() == {"detail": {"code": "invite_expiry_in_past"}}


async def test_an_expiry_needs_a_time_zone(client, admin, crew):
    response = await client.patch(
        f"/api/admin/crews/{crew.id}", json={"invite_expires_at": "2030-01-01T10:00:00"}
    )
    assert response.status_code == 422


async def test_sending_null_removes_a_limit(client, other_client, admin, crew):
    await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_max_uses": 1})
    await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_max_uses": None})
    row = (await client.get("/api/admin/crews")).json()[0]
    assert (row["invite_max_uses"], row["invite_status"]) == (None, "active")
    assert (await _join(other_client, "free@member.com", "IRONRIDGE")).status_code == 200


async def test_editing_a_name_leaves_limits_alone(client, admin, crew):
    await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_max_uses": 9})
    await client.patch(f"/api/admin/crews/{crew.id}", json={"name": "ATUS"})
    assert (await client.get("/api/admin/crews")).json()[0]["invite_max_uses"] == 9


@pytest.mark.parametrize("uses", [0, -1, 100_001])
async def test_max_uses_must_be_sane(client, admin, crew, uses):
    response = await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_max_uses": uses})
    assert response.status_code == 422


async def test_a_new_code_starts_counting_again(client, admin, crew):
    await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_max_uses": 1})
    assert (await client.get("/api/admin/crews")).json()[0]["invite_status"] == "used_up"
    custom = (
        await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_code": "FRESH1"})
    ).json()
    assert (custom["invite_uses"], custom["invite_status"]) == (0, "active")
    await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_code": "IRONRIDGE"})


async def test_a_failed_join_does_not_use_up_the_code(client, other_client, admin, crew):
    before = (await client.get("/api/admin/crews")).json()[0]["invite_uses"]
    await register_on(other_client, "twice@member.com", "IRONRIDGE")
    second = await other_client.post("/api/crews/join", json={"invite_code": "IRONRIDGE"})
    assert second.status_code == 409
    assert (await client.get("/api/admin/crews")).json()[0]["invite_uses"] == before + 1


async def test_emailing_an_invite_to_a_new_person(client, admin, crew, outbox):
    response = await client.post(
        f"/api/admin/crews/{crew.id}/invites", json={"email": "New@Friend.com", "language": "es"}
    )
    assert response.status_code == 200
    assert response.json() == {
        "sent": True,
        "link": "https://app.example.com/invite/IRONRIDGE",
        "existing_account": False,
    }
    message = outbox.sent[0]
    assert message.to == "new@friend.com"
    assert "Iron Ridge" in message.subject
    assert "https://app.example.com/invite/IRONRIDGE" in message.text
    assert "te invitó" in message.text
    log = (await _actions(client))[0]
    assert log["action"] == "invite_sent"
    assert "friend.com" not in str(log)


async def test_emailing_an_existing_account_without_a_crew_uses_its_language(
    client, other_client, admin, crew, outbox
):
    await register_on(other_client, "free@agent.com")
    await other_client.patch("/api/me", json={"language": "es"})
    response = await client.post(
        f"/api/admin/crews/{crew.id}/invites", json={"email": "free@agent.com", "language": "en"}
    )
    assert response.json()["existing_account"] is True
    assert "te invitó" in outbox.sent[0].text


async def test_an_invite_says_when_the_email_did_not_go_out(client, admin, crew, outbox):
    outbox.works = False
    response = await client.post(
        f"/api/admin/crews/{crew.id}/invites", json={"email": "new@friend.com"}
    )
    assert response.status_code == 200
    assert response.json()["sent"] is False
    assert response.json()["link"].endswith("/invite/IRONRIDGE")


async def test_someone_already_in_this_crew_is_not_invited(client, admin, maxo, crew, outbox):
    response = await client.post(
        f"/api/admin/crews/{crew.id}/invites", json={"email": "MAXO@example.com"}
    )
    assert response.status_code == 409
    assert response.json() == {"detail": {"code": "already_in_this_crew"}}
    assert outbox.sent == []


async def test_someone_in_another_crew_is_not_invited(client, other_client, admin, outbox):
    created = await client.post("/api/admin/crews", json={"name": "Other", "time_zone": "UTC"})
    await register_on(other_client, "busy@example.com", "IRONRIDGE")
    response = await client.post(
        f"/api/admin/crews/{created.json()['id']}/invites", json={"email": "busy@example.com"}
    )
    assert response.status_code == 409
    assert response.json() == {"detail": {"code": "member_in_other_crew"}}
    assert outbox.sent == []


async def test_a_dead_code_is_not_emailed(client, admin, crew, outbox):
    await client.patch(f"/api/admin/crews/{crew.id}", json={"invite_max_uses": 1})
    response = await client.post(
        f"/api/admin/crews/{crew.id}/invites", json={"email": "new@friend.com"}
    )
    assert response.status_code == 410
    assert outbox.sent == []


async def test_a_crew_name_cannot_inject_html_into_the_email(client, admin, outbox):
    created = await client.post(
        "/api/admin/crews", json={"name": "<img src=x>", "time_zone": "UTC"}
    )
    await client.post(
        f"/api/admin/crews/{created.json()['id']}/invites", json={"email": "new@friend.com"}
    )
    assert "<img" not in outbox.sent[0].html
    assert "&lt;img" in outbox.sent[0].html


async def test_an_adjustment_tells_the_member_and_why(client, other_client, admin, maxo):
    await client.post(
        f"/api/admin/members/{maxo['id']}/points", json={"points": -40, "reason": "Logged twice"}
    )
    item = (await other_client.get("/api/notifications")).json()["items"][0]
    assert item["key"] == "n_points_adjusted"
    assert item["vars"] == {"points": -40, "reason": "Logged twice"}
    assert item["link"] == "/me"
    # An admin acts for the crew, not as a person in it.
    assert item["actor"] is None
