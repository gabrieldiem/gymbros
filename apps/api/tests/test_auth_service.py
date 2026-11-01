"""AuthService against the real tables, with a controllable clock."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from db.repositories.crew_repository import CrewRepository
from db.repositories.session_repository import SessionRepository
from db.repositories.user_repository import UserRepository
from dependencies import password_hasher, session_tokens
from services.auth_service import AuthService
from services.auth_types import Registration
from services.crew_service import CrewService
from db.tables.auth_session import AuthSession
from services.errors import InvalidCredentials, NotAuthenticated


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
        hasher=password_hasher,
        tokens=session_tokens,
        session_ttl=timedelta(days=30),
        now=clock,
    )


def _registration(**overrides) -> Registration:
    values = {"email": "Gabi@Example.com", "password": "climbing-pw", "display_name": "Gabi"}
    values.update(overrides)
    return Registration(language="en", **values)


async def test_register_stores_a_hash_not_the_password(auth, db_session):
    logged_in = await auth.register(_registration())
    assert logged_in.user.email == "gabi@example.com"
    assert logged_in.user.password_hash.startswith("$argon2id$")
    assert "climbing-pw" not in logged_in.user.password_hash


async def test_session_expires_after_its_ttl(auth, clock):
    logged_in = await auth.register(_registration())
    assert (await auth.authenticate(logged_in.token)).id == logged_in.user.id
    clock.now += timedelta(days=30, seconds=1)
    with pytest.raises(NotAuthenticated):
        await auth.authenticate(logged_in.token)


async def _session_rows(db_session) -> int:
    return int(
        (await db_session.execute(select(func.count()).select_from(AuthSession))).scalar_one()
    )


async def test_logging_in_deletes_expired_sessions(auth, clock, db_session):
    await auth.register(_registration())
    await auth.register(_registration(email="maxo@example.com", display_name="Maxo"))
    clock.now += timedelta(days=30, seconds=1)  # both sessions are now expired
    assert await _session_rows(db_session) == 2
    await auth.log_in("gabi@example.com", "climbing-pw")
    assert await _session_rows(db_session) == 1  # only the new one


async def test_logging_in_keeps_live_sessions(auth, clock, db_session):
    first = await auth.register(_registration())
    clock.now += timedelta(days=29)
    await auth.log_in("gabi@example.com", "climbing-pw")
    assert await _session_rows(db_session) == 2
    assert (await auth.authenticate(first.token)).email == "gabi@example.com"


async def test_log_out_ends_the_session(auth):
    logged_in = await auth.register(_registration())
    await auth.log_out(logged_in.token)
    with pytest.raises(NotAuthenticated):
        await auth.authenticate(logged_in.token)


async def test_log_in_with_unknown_email_fails_like_a_wrong_password(auth):
    await auth.register(_registration())
    with pytest.raises(InvalidCredentials):
        await auth.log_in("nobody@example.com", "climbing-pw")
    with pytest.raises(InvalidCredentials):
        await auth.log_in("gabi@example.com", "wrong-password")


async def test_log_in_ignores_email_case(auth):
    await auth.register(_registration())
    assert (await auth.log_in("GABI@example.com", "climbing-pw")).user.display_name == "Gabi"
