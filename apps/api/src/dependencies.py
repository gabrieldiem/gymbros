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
from db.repositories.personal_record_repository import PersonalRecordRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.session_repository import SessionRepository
from db.repositories.user_repository import UserRepository
from db.repositories.workout_repository import WorkoutRepository
from db.tables.user import User
from initializers import init_logger
from services.auth_service import AuthService
from services.catalog import load_catalog
from services.climb_rules import CampScale
from services.climb_service import ClimbService
from services.crew_service import CrewService
from services.errors import NotInCrew
from services.member import Member
from services.password_hasher import Argon2PasswordHasher
from services.profile_service import ProfileService
from services.scoring_context import ScoringContextBuilder
from services.scoring_types import ScoringRules
from services.session_tokens import SessionTokens
from services.training_now_service import TrainingNowService
from services.workout_finisher import WorkoutFinisher
from services.workout_service import WorkoutService
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


async def get_current_member(
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> Member:
    """The signed-in user with their crew. Raises NotInCrew (→ 403) before they join one."""
    crew = await CrewRepository(session).get_crew_of(user.id)
    if crew is None:
        raise NotInCrew(str(user.id))
    return Member(user=user, crew=crew)


def get_scoring_rules() -> ScoringRules:
    """Point values and targets from settings."""
    return ScoringRules.from_settings(settings)


def _context(session: AsyncSession) -> ScoringContextBuilder:
    return ScoringContextBuilder(
        WorkoutRepository(session),
        PersonalRecordRepository(session),
        weekly_target=settings.game_weekly_target,
        weekly_event=settings.game_weekly_event,
    )


def get_workout_service(session: AsyncSession = Depends(get_session)) -> WorkoutService:
    """FastAPI dependency provider for WorkoutService."""
    return WorkoutService(
        WorkoutRepository(session), _context(session), load_catalog(), get_scoring_rules(), utc_now
    )


def build_climb_service(session: AsyncSession) -> ClimbService:
    """ClimbService wired to a session."""
    week_step = settings.game_week_scale // (settings.game_rank_count - 1)
    return ClimbService(
        crews=CrewRepository(session),
        events=PointEventRepository(session),
        workouts=WorkoutRepository(session),
        records=PersonalRecordRepository(session),
        scales={
            "all": CampScale(settings.game_rank_step, settings.game_rank_count),
            "week": CampScale(week_step, settings.game_rank_count),
        },
        weekly_target=settings.game_weekly_target,
    )


def get_climb_service(session: AsyncSession = Depends(get_session)) -> ClimbService:
    """FastAPI dependency provider for ClimbService."""
    return build_climb_service(session)


def get_workout_finisher(
    session: AsyncSession = Depends(get_session),
    workouts: WorkoutService = Depends(get_workout_service),
) -> WorkoutFinisher:
    """FastAPI dependency provider for WorkoutFinisher."""
    return WorkoutFinisher(
        workouts=workouts,
        climb=build_climb_service(session),
        workout_rows=WorkoutRepository(session),
        context=_context(session),
        records=PersonalRecordRepository(session),
        events=PointEventRepository(session),
        catalog=load_catalog(),
        rules=get_scoring_rules(),
        now=utc_now,
    )


def get_scoring_context(session: AsyncSession = Depends(get_session)) -> ScoringContextBuilder:
    """FastAPI dependency provider for ScoringContextBuilder."""
    return _context(session)


def get_training_now_service(
    session: AsyncSession = Depends(get_session),
) -> TrainingNowService:
    """FastAPI dependency provider for TrainingNowService."""
    return TrainingNowService(WorkoutRepository(session))
