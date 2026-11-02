"""The backoffice: who gets in, and that every change works and is audited."""

import pytest

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
