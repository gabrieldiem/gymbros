"""Apply Alembic migrations. Used by the dev lifespan, the production image's start command
(`cli.py migrate`) and the test fixtures, so all of them migrate the same way."""

from logging import getLogger
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig
from alembic.script.revision import ResolutionError
from alembic.util import CommandError

# alembic.ini lives next to src/ (repo: apps/api/alembic.ini; image: /alembic.ini).
_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


def run_migrations(config: AlembicConfig | None = None) -> None:
    """Upgrade the configured database to `head`. Blocking: call through asyncio.to_thread.

    A revision this code doesn't know means a newer version already migrated the database and this
    one is being rolled back to: it must still start, or a rollback after any migration would
    fail. Migrations stay backward compatible for this (see apps/api/CLAUDE.md).
    """
    try:
        command.upgrade(config or AlembicConfig(str(_ALEMBIC_INI)), "head")
    except CommandError as error:
        if not isinstance(error.__cause__, ResolutionError):
            raise
        getLogger(__name__).warning("Skipping migrations, the database is ahead: %s", error)
