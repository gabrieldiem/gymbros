"""Dependency injection module: module-level singletons plus `Depends` providers."""

from logging import Logger
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from initializers import init_logger
from settings import Settings

settings: Settings = Settings.get_settings()
logger: Logger = init_logger(settings)
engine: AsyncEngine = create_async_engine(settings.database_url, pool_pre_ping=True)
session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine, expire_on_commit=False
)


def get_settings() -> Settings:
    """FastAPI dependency provider for Settings."""
    return settings


def get_engine() -> AsyncEngine:
    """FastAPI dependency provider for the database engine."""
    return engine


async def get_session() -> AsyncIterator[AsyncSession]:
    """One session per request. Commits on success, rolls back on error."""
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except BaseException:
            await session.rollback()
            raise
