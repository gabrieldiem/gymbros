"""Apply Alembic migrations. Used by the dev lifespan and the test fixtures, so both migrate
the same way the `make migrate` command does."""

from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig

# alembic.ini lives next to src/ (repo: apps/api/alembic.ini; image: /alembic.ini).
_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


def run_migrations() -> None:
    """Upgrade the configured database to `head`. Blocking: call through asyncio.to_thread."""
    command.upgrade(AlembicConfig(str(_ALEMBIC_INI)), "head")
