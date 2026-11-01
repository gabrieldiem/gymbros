"""AuthService against the real tables, with a controllable clock."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from db.repositories.crew_repository import CrewRepository
from db.repositories.session_repository import SessionRepository
from db.repositories.user_repository import UserRepository
from db.tables.auth_session import AuthSession
from dependencies import session_tokens
from services.auth_service import AuthService
from services.auth_types import DevLogin
from services.crew_service import CrewService
from services.errors import NotAuthenticated
from services.google_identity import GoogleIdentity

GABI = GoogleIdentity("google-gabi", "gabi@example.com", "Gabi")
MAXO = GoogleIdentity("google-maxo", "maxo@example.com", "Maxo")


class Clock:
    """A clock the test can move."""

    def __init__(self) -> None:
        self.now = datetime(2026, 11, 2, 9, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def auth(db_session, clock) -> AuthService:
    return AuthService(
        users=UserRepository(db_session),
        sessions=SessionRepository(db_session),
        crews=CrewService(CrewRepository(db_session)),
        tokens=session_tokens,
        session_ttl=timedelta(days=30),
        now=clock,
    )


async def _session_rows(db_session) -> int:
    query = select(func.count()).select_from(AuthSession)
    return int((await db_session.execute(query)).scalar_one())


async def test_a_new_google_account_has_no_password(auth):
    logged_in = await auth.sign_in_with_google(GABI, "es")
    assert logged_in.created is True
    assert logged_in.user.email == "gabi@example.com"
    assert logged_in.user.google_sub == "google-gabi"
    assert logged_in.user.password_hash is None
    assert logged_in.user.language == "es"


async def test_a_returning_account_is_not_created_again(auth):
    first = await auth.sign_in_with_google(GABI, "en")
    second = await auth.sign_in_with_google(GABI, "es")
    assert second.created is False
    assert second.user.id == first.user.id
    assert second.user.language == "en"


async def test_an_account_with_that_email_is_linked_once(auth):
    existing = await auth.dev_log_in(DevLogin(email="gabi@example.com"))
    assert existing.user.google_sub is None
    linked = await auth.sign_in_with_google(GABI, "en")
    assert linked.created is False
    assert linked.user.id == existing.user.id
    assert linked.user.google_sub == "google-gabi"


async def test_the_dev_login_names_the_account_from_the_email(auth):
    logged_in = await auth.dev_log_in(DevLogin(email="Maxo@Example.com"))
    assert logged_in.user.email == "maxo@example.com"
    assert logged_in.user.display_name == "Maxo"


async def test_session_expires_after_its_ttl(auth, clock):
    logged_in = await auth.sign_in_with_google(GABI, "en")
    assert (await auth.authenticate(logged_in.token)).id == logged_in.user.id
    clock.now += timedelta(days=30, seconds=1)
    with pytest.raises(NotAuthenticated):
        await auth.authenticate(logged_in.token)


async def test_signing_in_deletes_expired_sessions(auth, clock, db_session):
    await auth.sign_in_with_google(GABI, "en")
    await auth.sign_in_with_google(MAXO, "en")
    clock.now += timedelta(days=30, seconds=1)  # both sessions are now expired
    assert await _session_rows(db_session) == 2
    await auth.sign_in_with_google(GABI, "en")
    assert await _session_rows(db_session) == 1  # only the new one


async def test_signing_in_keeps_live_sessions(auth, clock, db_session):
    first = await auth.sign_in_with_google(GABI, "en")
    clock.now += timedelta(days=29)
    await auth.sign_in_with_google(GABI, "en")
    assert await _session_rows(db_session) == 2
    assert (await auth.authenticate(first.token)).email == "gabi@example.com"


async def test_log_out_ends_the_session(auth):
    logged_in = await auth.sign_in_with_google(GABI, "en")
    await auth.log_out(logged_in.token)
    with pytest.raises(NotAuthenticated):
        await auth.authenticate(logged_in.token)
