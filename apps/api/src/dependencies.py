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
from db.repositories.badge_repository import BadgeRepository
from db.repositories.crew_repository import CrewRepository
from db.repositories.duel_repository import DuelRepository
from db.repositories.feed_repository import FeedRepository
from db.repositories.notification_repository import NotificationRepository
from db.repositories.personal_record_repository import PersonalRecordRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.session_repository import SessionRepository
from db.repositories.user_repository import UserRepository
from db.repositories.workout_repository import WorkoutRepository
from db.repositories.workout_stats_repository import WorkoutStatsRepository
from db.tables.user import User
from initializers import init_logger
from services.activity_service import ActivityService
from services.auth_service import AuthService
from services.badge_service import BadgeService
from services.bonus_service import BonusService
from services.catalog import load_catalog
from services.climb_rules import CampScale
from services.climb_service import ClimbService
from services.crew_service import CrewService
from services.duel_service import DuelService
from services.errors import NotInCrew
from services.feed_service import FeedService
from services.hall_of_fame_service import HallOfFameService
from services.inbox_service import InboxService
from services.me_stats_service import MeStatsService
from services.member import Member
from services.notifier import Notifier
from services.nudge_service import NudgeService
from services.password_hasher import Argon2PasswordHasher
from services.profile_service import ProfileService
from services.quest_service import QuestService
from services.recap_service import RecapService
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


def _notifier(session: AsyncSession) -> Notifier:
    return Notifier(NotificationRepository(session), utc_now)


def build_activity_service(session: AsyncSession) -> ActivityService:
    """ActivityService wired to a session."""
    return ActivityService(
        feed=FeedRepository(session),
        crews=CrewRepository(session),
        events=PointEventRepository(session),
        notifier=_notifier(session),
        weekly_target=settings.game_weekly_target,
        close_behind_points=settings.social_close_behind_points,
        now=utc_now,
    )


def get_workout_service(session: AsyncSession = Depends(get_session)) -> WorkoutService:
    """FastAPI dependency provider for WorkoutService."""
    return WorkoutService(
        WorkoutRepository(session),
        _context(session),
        load_catalog(),
        get_scoring_rules(),
        utc_now,
        activity=build_activity_service(session),
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
        activity=build_activity_service(session),
        bonus=build_bonus_service(session),
    )


def get_scoring_context(session: AsyncSession = Depends(get_session)) -> ScoringContextBuilder:
    """FastAPI dependency provider for ScoringContextBuilder."""
    return _context(session)


def get_training_now_service(
    session: AsyncSession = Depends(get_session),
) -> TrainingNowService:
    """FastAPI dependency provider for TrainingNowService."""
    return TrainingNowService(WorkoutRepository(session))


def get_feed_service(session: AsyncSession = Depends(get_session)) -> FeedService:
    """FastAPI dependency provider for FeedService."""
    return FeedService(
        feed=FeedRepository(session),
        users=UserRepository(session),
        crews=CrewRepository(session),
        workouts=WorkoutRepository(session),
        notifier=_notifier(session),
        inactive_days=settings.social_inactive_days,
        now=utc_now,
        badges=build_badge_service(session),
    )


def get_nudge_service(session: AsyncSession = Depends(get_session)) -> NudgeService:
    """FastAPI dependency provider for NudgeService."""
    return NudgeService(
        CrewRepository(session), NotificationRepository(session), _notifier(session), utc_now
    )


def get_inbox_service(session: AsyncSession = Depends(get_session)) -> InboxService:
    """FastAPI dependency provider for InboxService."""
    return InboxService(
        NotificationRepository(session),
        UserRepository(session),
        utc_now,
        keep_days=settings.social_notification_days,
    )


def get_hall_of_fame_service(
    session: AsyncSession = Depends(get_session),
) -> HallOfFameService:
    """FastAPI dependency provider for HallOfFameService."""
    return HallOfFameService(
        climb=build_climb_service(session),
        crews=CrewRepository(session),
        records=PersonalRecordRepository(session),
        workouts=WorkoutRepository(session),
        weekly_target=settings.game_weekly_target,
        now=utc_now,
    )


def build_quest_service(session: AsyncSession) -> QuestService:
    """QuestService wired to a session."""
    return QuestService(
        (
            WorkoutRepository(session),
            PointEventRepository(session),
            CrewRepository(session),
            UserRepository(session),
        ),
        load_catalog(),
        {
            "bodyweight_kg": settings.game_bodyweight_kg,
            "crew_quest_goal": settings.scoring_crew_quest_goal,
            "crew_quest": settings.scoring_crew_quest,
            "bounty": settings.scoring_bounty,
            "duel_win": settings.scoring_duel_win,
            "weekly_event": settings.game_weekly_event,
        },
        utc_now,
    )


def build_badge_service(session: AsyncSession) -> BadgeService:
    """BadgeService wired to a session."""
    return BadgeService(
        (
            WorkoutRepository(session),
            WorkoutStatsRepository(session),
            PointEventRepository(session),
            FeedRepository(session),
            BadgeRepository(session),
        ),
        load_catalog(),
        settings.game_weekly_target,
        utc_now,
    )


def build_bonus_service(session: AsyncSession) -> BonusService:
    """BonusService wired to a session."""
    return BonusService(
        build_quest_service(session),
        build_badge_service(session),
        PointEventRepository(session),
        utc_now,
    )


def get_quest_service(session: AsyncSession = Depends(get_session)) -> QuestService:
    """FastAPI dependency provider for QuestService."""
    return build_quest_service(session)


def get_badge_service(session: AsyncSession = Depends(get_session)) -> BadgeService:
    """FastAPI dependency provider for BadgeService."""
    return build_badge_service(session)


def get_duel_service(session: AsyncSession = Depends(get_session)) -> DuelService:
    """FastAPI dependency provider for DuelService."""
    return DuelService(
        (
            DuelRepository(session),
            PointEventRepository(session),
            WorkoutStatsRepository(session),
            CrewRepository(session),
            UserRepository(session),
        ),
        _notifier(session),
        settings.scoring_duel_win,
        utc_now,
    )


def get_recap_service(session: AsyncSession = Depends(get_session)) -> RecapService:
    """FastAPI dependency provider for RecapService."""
    return RecapService(
        (PointEventRepository(session), WorkoutRepository(session), CrewRepository(session)),
        get_hall_of_fame_service(session),
        build_quest_service(session),
        (settings.game_weekly_target, settings.game_weekly_event or None),
        utc_now,
    )


def get_me_stats_service(session: AsyncSession = Depends(get_session)) -> MeStatsService:
    """FastAPI dependency provider for MeStatsService."""
    return MeStatsService(
        build_climb_service(session),
        (
            WorkoutRepository(session),
            WorkoutStatsRepository(session),
            PersonalRecordRepository(session),
            BadgeRepository(session),
        ),
        load_catalog(),
        utc_now,
    )
