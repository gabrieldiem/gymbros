"""Starting on a database a newer version already migrated: what a rollback does."""

# pylint: disable=redefined-outer-name

import asyncio
import logging
from collections.abc import AsyncIterator
from pathlib import Path

import asyncpg
import pytest
from alembic.config import Config as AlembicConfig
from alembic.util import CommandError
from sqlalchemy.engine import make_url

from db.migrate import run_migrations
from dependencies import settings

_INI = Path(__file__).resolve().parents[1] / "alembic.ini"
_DB = "gymbros_migrate_test"


def _connect(database: str):
    return asyncpg.connect(
        host=settings.postgres_host,
        port=settings.postgres_port,
        user=settings.postgres_user,
        password=settings.postgres_password,
        database=database,
    )


async def _set_revision(revision: str) -> None:
    connection = await _connect(_DB)
    try:
        await connection.execute("UPDATE alembic_version SET version_num = $1", revision)
    finally:
        await connection.close()


@pytest.fixture
async def config(migrated_database) -> AsyncIterator[AlembicConfig]:
    """An Alembic config pointing at its own scratch database, dropped afterwards."""
    del migrated_database
    admin = await _connect("postgres")
    await admin.execute(f'DROP DATABASE IF EXISTS "{_DB}"')
    await admin.execute(f'CREATE DATABASE "{_DB}"')
    url = make_url(settings.database_url).set(database=_DB)
    alembic_config = AlembicConfig(str(_INI))
    alembic_config.set_main_option(
        "sqlalchemy.url", url.render_as_string(hide_password=False).replace("%", "%%")
    )
    try:
        yield alembic_config
    finally:
        await admin.execute(f'DROP DATABASE IF EXISTS "{_DB}" WITH (FORCE)')
        await admin.close()


async def test_a_database_ahead_of_this_code_is_left_alone(config, caplog):
    await asyncio_run(config)
    await _set_revision("from_a_newer_version")
    with caplog.at_level(logging.WARNING, logger="db.migrate"):
        await asyncio_run(config)
    assert "the database is ahead" in caplog.text


async def test_other_alembic_errors_still_fail(config, monkeypatch):
    def broken(*_args, **_kwargs):
        raise CommandError("the migration itself failed")

    monkeypatch.setattr("db.migrate.command.upgrade", broken)
    with pytest.raises(CommandError):
        await asyncio_run(config)


async def asyncio_run(config: AlembicConfig) -> None:
    """Alembic's async env.py runs its own event loop, so this needs its own thread."""
    await asyncio.to_thread(run_migrations, config)
