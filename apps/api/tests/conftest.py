"""Shared test fixtures for the GYMBROS API test suite."""

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env first (it never overrides real env vars, e.g. CI's), so the defaults below only fill
# what neither provides. Settings._validate() runs at import time through `dependencies.py`. Set safe values BEFORE any
# test module imports the app. The database name is forced (not setdefault) so a developer's .env
# can never point the suite at the dev database: every test rolls back, but migrations do not.
load_dotenv()  # searches upward from this file: finds the repo-root .env, if any
os.environ.setdefault("POSTGRES_PASSWORD", "gymbros")
os.environ.setdefault("SESSION_SECRET", "test-session-secret-at-least-32-characters")
os.environ["APP_ENV"] = "test"
os.environ["POSTGRES_DB"] = os.getenv("TEST_POSTGRES_DB", "gymbros_test")
os.environ["RUN_MIGRATIONS_ON_STARTUP"] = "false"

# pylint: disable=wrong-import-position,redefined-outer-name
from typing import AsyncIterator  # noqa: E402

import asyncpg  # noqa: E402
import pytest  # noqa: E402
import uvloop  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config as AlembicConfig  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession  # noqa: E402

from dependencies import engine, get_session, settings  # noqa: E402
from main import app  # noqa: E402

_ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


@pytest.hookimpl(tryfirst=True)
def pytest_configure(config: pytest.Config) -> None:
    """Allow sockets to loopback and the test database host only (pytest-socket)."""
    hosts = {"127.0.0.1", "::1", "localhost", settings.postgres_host}
    config.option.allow_hosts = ",".join(sorted(hosts))


def pytest_asyncio_loop_factories(config: pytest.Config, item: pytest.Item):
    """Run the suite on uvloop, the loop uvicorn runs on in production."""
    del config, item
    return {"uvloop": uvloop.new_event_loop}


async def _ensure_test_database() -> None:
    """CREATE DATABASE gymbros_test on first run, through the server's maintenance database."""
    connection = await asyncpg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        user=settings.postgres_user,
        password=settings.postgres_password,
        database="postgres",
    )
    try:
        exists = await connection.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", settings.postgres_db
        )
        if not exists:
            await connection.execute(f'CREATE DATABASE "{settings.postgres_db}"')
    finally:
        await connection.close()


def _migrate_test_database() -> None:
    config = AlembicConfig(str(_ALEMBIC_INI))
    config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
    command.upgrade(config, "head")


@pytest.fixture(scope="session")
async def migrated_database() -> None:
    """Create and migrate the test database once per session."""
    await _ensure_test_database()
    await asyncio.to_thread(_migrate_test_database)


@pytest.fixture
async def db_connection(migrated_database) -> AsyncIterator[AsyncConnection]:
    """A connection inside an outer transaction that is always rolled back."""
    async with engine.connect() as connection:
        transaction = await connection.begin()
        try:
            yield connection
        finally:
            await transaction.rollback()


@pytest.fixture
async def db_session(db_connection: AsyncConnection) -> AsyncIterator[AsyncSession]:
    """A session whose commits become savepoints of the rolled-back outer transaction."""
    session = AsyncSession(
        bind=db_connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
    )
    try:
        yield session
    finally:
        await session.close()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """HTTP client against the app, with every request sharing the test's session."""

    async def _override_session() -> AsyncIterator[AsyncSession]:
        yield db_session
        await db_session.commit()

    app.dependency_overrides[get_session] = _override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()
