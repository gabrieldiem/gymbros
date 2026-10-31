"""Register, log in, log out and the session cookie."""

from tests.application.conftest import PASSWORD


async def test_register_creates_the_account_and_signs_in(client, register):
    response = await register(language="es")
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "gabi@example.com"
    assert body["initials"] == "GA"
    assert body["language"] == "es"
    assert body["crew"] is None
    assert "password" not in str(body)
    assert (await client.get("/api/me")).status_code == 200


async def test_session_cookie_is_http_only_and_lax(register):
    response = await register()
    cookie = response.headers["set-cookie"].lower()
    assert "gymbros_session=" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie


async def test_register_with_invite_code_joins_the_crew(register, crew):
    response = await register(invite_code="ironridge")
    assert response.status_code == 201
    assert response.json()["crew"]["name"] == "Iron Ridge"
    assert response.json()["color"] == "volt"


async def test_register_with_unknown_invite_code_creates_nothing(client, register, crew):
    response = await register(invite_code="NOPE1234")
    assert response.status_code == 404
    assert response.json() == {"detail": {"code": "invite_code_not_found"}}
    login = await client.post(
        "/api/auth/login", json={"email": "gabi@example.com", "password": PASSWORD}
    )
    assert login.status_code == 401


async def test_register_twice_with_the_same_email_conflicts(register):
    await register()
    response = await register(email="GABI@example.com")
    assert response.status_code == 409
    assert response.json() == {"detail": {"code": "email_taken"}}


async def test_register_validates_input(register):
    assert (await register(email="not-an-email")).status_code == 422
    assert (await register(password="short")).status_code == 422
    assert (await register(display_name="   ")).status_code == 422
    assert (await register(language="fr")).status_code == 422


async def test_login_and_logout(client, register):
    await register()
    await client.post("/api/auth/logout")
    assert (await client.get("/api/me")).status_code == 401

    login = await client.post(
        "/api/auth/login", json={"email": "gabi@example.com", "password": PASSWORD}
    )
    assert login.status_code == 200
    assert login.json()["display_name"] == "Gabi"
    assert (await client.get("/api/me")).status_code == 200

    logout = await client.post("/api/auth/logout")
    assert logout.status_code == 204
    assert (await client.get("/api/me")).status_code == 401


async def test_login_with_wrong_password_is_unauthorized(client, register):
    await register()
    response = await client.post(
        "/api/auth/login", json={"email": "gabi@example.com", "password": "nope-nope"}
    )
    assert response.status_code == 401
    assert response.json() == {"detail": {"code": "invalid_credentials"}}


async def test_logout_without_a_session_still_succeeds(client):
    assert (await client.post("/api/auth/logout")).status_code == 204


async def test_a_forged_cookie_is_rejected(client):
    client.cookies.set("gymbros_session", "forged-token")
    response = await client.get("/api/me")
    assert response.status_code == 401
    assert response.json() == {"detail": {"code": "not_authenticated"}}
