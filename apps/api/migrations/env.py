"""Alembic environment: async engine, URL and metadata from the application."""

import asyncio
import sys
from pathlib import Path

from alembic import context
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

# Repo layout: apps/api/migrations + apps/api/src. Image layout: /migrations + /app (on sys.path).
_SRC = Path(__file__).resolve().parents[1] / "src"
if _SRC.is_dir():
    sys.path.insert(0, str(_SRC))

# pylint: disable=wrong-import-position
import db.tables  # noqa: E402,F401  (registers every table on Base.metadata)
from db.base import Base  # noqa: E402
from settings import Settings  # noqa: E402

target_metadata = Base.metadata


def _url() -> str:
    """The test suite passes its own URL; everything else uses Settings."""
    return context.config.get_main_option("sqlalchemy.url") or Settings.get_settings().database_url


def run_migrations_offline() -> None:
    """Emit SQL to stdout without a database connection."""
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def _run_sync(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations on an async connection."""
    engine = create_async_engine(_url())
    async with engine.connect() as connection:
        await connection.run_sync(_run_sync)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
