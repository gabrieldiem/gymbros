"""Dependency injection module: module-level singletons plus `Depends` providers."""

from datetime import timedelta
from logging import Logger
from typing import AsyncIterator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from clock import utc_now
from db.repositories.crew_repository import CrewRepository
from db.repositories.session_repository import SessionRepository
from db.repositories.user_repository import UserRepository
from db.tables.user import User
from initializers import init_logger
from services.auth_service import AuthService
from services.crew_service import CrewService
from services.password_hasher import Argon2PasswordHasher
from services.profile_service import ProfileService
from services.session_tokens import SessionTokens
from settings import Settings

settings: Settings = Settings.get_settings()
logger: Logger = init_logger(settings)
engine: AsyncEngine = create_async_engine(settings.database_url, pool_pre_ping=True)
session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine, expire_on_commit=False
)
password_hasher = Argon2PasswordHasher()
session_tokens = SessionTokens(settings.session_secret)


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


def get_crew_service(session: AsyncSession = Depends(get_session)) -> CrewService:
    """FastAPI dependency provider for CrewService."""
    return CrewService(CrewRepository(session))


def get_profile_service(session: AsyncSession = Depends(get_session)) -> ProfileService:
    """FastAPI dependency provider for ProfileService."""
    return ProfileService(UserRepository(session), CrewRepository(session))


def build_auth_service(session: AsyncSession) -> AuthService:
    """AuthService wired to a session. Also used by the CLI."""
    return AuthService(
        users=UserRepository(session),
        sessions=SessionRepository(session),
        crews=CrewService(CrewRepository(session)),
        hasher=password_hasher,
        tokens=session_tokens,
        session_ttl=timedelta(days=settings.session_max_age_days),
        now=utc_now,
    )


def get_auth_service(session: AsyncSession = Depends(get_session)) -> AuthService:
    """FastAPI dependency provider for AuthService."""
    return build_auth_service(session)


def get_session_token(request: Request) -> str | None:
    """The raw session token from the cookie, if present."""
    return request.cookies.get(settings.session_cookie_name)


async def get_current_user(
    token: str | None = Depends(get_session_token),
    auth: AuthService = Depends(get_auth_service),
) -> User:
    """The signed-in user. Raises NotAuthenticated (→ 401) without a valid session."""
    return await auth.authenticate(token)
