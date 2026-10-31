"""Database reachability probe for /health."""

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine


async def is_database_up(engine: AsyncEngine) -> bool:
    """Run `SELECT 1`. Any driver or connection error means the database is down."""
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError):
        return False
    return True
