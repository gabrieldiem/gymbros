"""Google sign-in, dev login, log out and the session cookie over HTTP."""

from urllib.parse import parse_qs, urlparse

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from db.tables.user import User
from dependencies import get_email_sender, get_google_sign_in, get_settings, settings
from main import app
from services.errors import GoogleSignInFailed
from services.google_identity import GoogleIdentity

CALLBACK = "/api/auth/google/callback"
IDENTITY = GoogleIdentity("google-123", "gabi@example.com", "Gabi")


class FakeGoogle:
    """Stands in for Google: always signs in as `identity`, or fails when told to."""

    def __init__(self) -> None:
        self.identity = IDENTITY
        self.failure: GoogleSignInFailed | None = None
        self.codes: list[str] = []

    def authorization_url(self, attempt) -> str:
        return f"https://accounts.google.com/auth?state={attempt.state}"

    async def identify(self, code, _attempt) -> GoogleIdentity:
        self.codes.append(code)
        if self.failure:
            raise self.failure
        return self.identity


class FakeEmail:
    """Collects what would have been sent."""

    def __init__(self) -> None:
        self.sent = []

    async def send(self, message) -> None:
        self.sent.append(message)


@pytest.fixture
def google(client):
    fake = FakeGoogle()
    app.dependency_overrides[get_google_sign_in] = lambda: fake
    return fake


@pytest.fixture
def outbox(client):
    fake = FakeEmail()
    app.dependency_overrides[get_email_sender] = lambda: fake
    return fake


async def _start(client, lang="en") -> str:
    """Begin an attempt (the client keeps its cookie) and return the state sent to Google."""
    response = await client.get(f"/api/auth/google/start?lang={lang}")
    assert response.status_code == 302
    return parse_qs(urlparse(response.headers["location"]).query)["state"][0]


async def _sign_in(client, lang="en"):
    state = await _start(client, lang)
    return await client.get(f"{CALLBACK}?code=the-code&state={state}")


# --- Google sign-in -------------------------------------------------------------------------


async def test_start_redirects_to_google_with_an_http_only_attempt_cookie(client, google):
    response = await client.get("/api/auth/google/start")
    assert response.headers["location"].startswith("https://accounts.google.com/")
    cookie = response.headers["set-cookie"].lower()
    assert "gymbros_oauth=" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/api/auth/google" in cookie


async def test_first_sign_in_creates_the_account_and_lands_on_the_app(client, google, outbox):
    response = await _sign_in(client, "es")
    assert response.status_code == 302
    assert response.headers["location"] == "https://app.example.com/climb"
    assert google.codes == ["the-code"]
    me = (await client.get("/api/me")).json()
    assert me["email"] == "gabi@example.com"
    assert me["display_name"] == "Gabi"
    assert me["initials"] == "GA"
    assert me["language"] == "es"
    assert me["crew"] is None


async def test_the_session_cookie_is_http_only_and_lax(client, google, outbox):
    response = await _sign_in(client)
    cookies = [c.lower() for c in response.headers.get_list("set-cookie")]
    session = next(c for c in cookies if c.startswith("gymbros_session="))
    assert "httponly" in session
    assert "samesite=lax" in session


async def test_a_new_account_gets_one_welcome_email_in_its_language(client, google, outbox):
    await _sign_in(client, "es")
    assert [m.to for m in outbox.sent] == ["gabi@example.com"]
    assert "Hola Gabi" in outbox.sent[0].text
    await client.post("/api/auth/logout")
    await _sign_in(client, "es")
    assert len(outbox.sent) == 1


async def test_signing_in_again_finds_the_same_account_even_with_a_new_email(
    client, google, outbox, db_session
):
    await _sign_in(client)
    first = (await client.get("/api/me")).json()["id"]
    await client.post("/api/auth/logout")
    google.identity = GoogleIdentity("google-123", "new-address@example.com", "Gabi")
    await _sign_in(client)
    assert (await client.get("/api/me")).json()["id"] == first
    assert len((await db_session.execute(select(User))).scalars().all()) == 1


async def test_an_existing_account_with_that_email_is_linked_and_keeps_its_data(
    client, google, outbox, register, crew, db_session
):
    before = (await register(invite_code="IRONRIDGE", display_name="Gabo")).json()
    await client.post("/api/auth/logout")
    await _sign_in(client)
    me = (await client.get("/api/me")).json()
    assert me["id"] == before["id"]
    assert me["display_name"] == "Gabo"
    assert me["crew"]["name"] == "Iron Ridge"
    assert outbox.sent == []
    user = (await db_session.execute(select(User))).scalar_one()
    assert user.google_sub == "google-123"


async def test_a_long_google_name_is_cut_to_fit(client, google, outbox):
    google.identity = GoogleIdentity("g", "long@example.com", "A" * 40)
    await _sign_in(client)
    assert (await client.get("/api/me")).json()["display_name"] == "A" * 24


async def _assert_failed(client, response):
    assert response.status_code == 302
    assert response.headers["location"] == "https://app.example.com/login?auth_error=google"
    assert (await client.get("/api/me")).status_code == 401


async def test_a_wrong_state_never_reaches_google(client, google, outbox):
    await _start(client)
    await _assert_failed(client, await client.get(f"{CALLBACK}?code=the-code&state=forged"))
    assert google.codes == []


async def test_a_callback_without_the_attempt_cookie_fails(client, google, outbox):
    await _assert_failed(client, await client.get(f"{CALLBACK}?code=the-code&state=anything"))
    assert google.codes == []


async def test_a_denied_consent_fails(client, google, outbox):
    state = await _start(client)
    await _assert_failed(client, await client.get(f"{CALLBACK}?error=access_denied&state={state}"))


async def test_a_failure_at_google_fails_without_an_account(client, google, outbox, db_session):
    google.failure = GoogleSignInFailed("token exchange failed")
    await _assert_failed(client, await _sign_in(client))
    assert (await db_session.execute(select(User))).first() is None


async def test_an_attempt_cannot_be_reused(client, google, outbox):
    state = await _start(client)
    await client.get(f"{CALLBACK}?code=the-code&state={state}")
    await client.post("/api/auth/logout")
    await _assert_failed(client, await client.get(f"{CALLBACK}?code=the-code&state={state}"))


async def test_without_credentials_the_button_leads_back_to_the_login_screen(client):
    app.dependency_overrides[get_google_sign_in] = lambda: None
    response = await client.get("/api/auth/google/start")
    assert response.headers["location"] == "https://app.example.com/login?auth_error=google"


# --- Options and the dev login --------------------------------------------------------------


async def test_options_report_how_to_sign_in(client):
    assert (await client.get("/api/auth/options")).json() == {"google": True, "dev_login": True}


async def test_the_dev_login_creates_the_account_and_joins_the_crew(register, crew):
    response = await register(invite_code="ironridge", language="es")
    assert response.status_code == 200
    assert response.json()["crew"]["name"] == "Iron Ridge"
    assert response.json()["language"] == "es"
    assert response.json()["color"] == "volt"


async def test_the_dev_login_with_an_unknown_code_creates_nothing(
    client, register, crew, db_session
):
    response = await register(invite_code="NOPE1234")
    assert response.status_code == 404
    assert response.json() == {"detail": {"code": "invite_code_not_found"}}
    assert (await db_session.execute(select(User))).first() is None


async def test_the_dev_login_validates_input(register):
    assert (await register(email="not-an-email")).status_code == 422
    assert (await register(display_name="   ")).status_code == 422
    assert (await register(language="fr")).status_code == 422


async def test_the_dev_login_is_a_404_when_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "dev_login_enabled", False)
    app.dependency_overrides[get_settings] = lambda: settings
    response = await client.post("/api/auth/dev-login", json={"email": "gabi@example.com"})
    assert response.status_code == 404
    assert (await client.get("/api/auth/options")).json()["dev_login"] is False


async def test_no_password_endpoints_remain(client):
    assert (await client.post("/api/auth/login", json={})).status_code == 404
    assert (await client.post("/api/auth/register", json={})).status_code == 404


# --- Sessions -------------------------------------------------------------------------------


async def test_logging_out_ends_the_session(client, register):
    await register()
    assert (await client.get("/api/me")).status_code == 200
    assert (await client.post("/api/auth/logout")).status_code == 204
    assert (await client.get("/api/me")).status_code == 401


async def test_logout_without_a_session_still_succeeds(client):
    assert (await client.post("/api/auth/logout")).status_code == 204


async def test_a_forged_cookie_is_rejected(client):
    client.cookies.set("gymbros_session", "forged-token")
    response = await client.get("/api/me")
    assert response.status_code == 401
    assert response.json() == {"detail": {"code": "not_authenticated"}}


async def test_two_browsers_have_separate_sessions(client, register):
    await register()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other:
        assert (await other.get("/api/me")).status_code == 401
