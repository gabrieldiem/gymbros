"""SQL for the backoffice: aggregates across every crew, and the audit log."""

import uuid
from datetime import datetime

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.admin_action import AdminAction
from db.tables.crew import Crew
from db.tables.membership import Membership
from db.tables.point_event import PointEvent
from db.tables.user import User
from db.tables.workout import Workout
from services.admin_types import CrewRow, MemberRow, Overview

_MEMBERS_LIMIT = 200
_ACTIONS_LIMIT = 100


class AdminRepository:
    """Reads and writes that aren't scoped to one member's crew."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def overview(self, since: datetime) -> Overview:
        """Totals, and what happened since `since`."""
        finished = Workout.finished_at.is_not(None)
        recent = (finished, Workout.finished_at >= since)
        return Overview(
            users=await self._scalar(select(func.count()).select_from(User)),
            crews=await self._scalar(select(func.count()).select_from(Crew)),
            users_without_crew=await self._scalar(
                select(func.count())
                .select_from(User)
                .outerjoin(Membership, Membership.user_id == User.id)
                .where(Membership.user_id.is_(None))
            ),
            workouts=await self._scalar(select(func.count()).select_from(Workout).where(finished)),
            recent_workouts=await self._scalar(
                select(func.count()).select_from(Workout).where(*recent)
            ),
            recent_active_users=await self._scalar(
                select(func.count(func.distinct(Workout.user_id))).where(*recent)
            ),
            recent_points=await self._scalar(
                select(func.coalesce(func.sum(PointEvent.points), 0)).where(
                    PointEvent.created_at >= since
                )
            ),
        )

    async def _scalar(self, query) -> int:
        return int(await self._session.scalar(query) or 0)

    async def crews(self) -> list[CrewRow]:
        """Every crew with its member count and all-time points, newest first."""
        members = (
            select(func.count())
            .where(Membership.crew_id == Crew.id)
            .correlate(Crew)
            .scalar_subquery()
        )
        points = (
            select(func.coalesce(func.sum(PointEvent.points), 0))
            .where(PointEvent.crew_id == Crew.id)
            .correlate(Crew)
            .scalar_subquery()
        )
        result = await self._session.execute(
            select(Crew, members, points).order_by(Crew.created_at.desc())
        )
        return [CrewRow(crew, int(count), int(total)) for crew, count, total in result.all()]

    async def members(self, search: str | None) -> list[MemberRow]:
        """Accounts matching the search (name or email), newest first, with crew and totals."""
        points = (
            select(func.coalesce(func.sum(PointEvent.points), 0))
            .where(PointEvent.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
        )
        workouts = (
            select(func.count())
            .where(Workout.user_id == User.id, Workout.finished_at.is_not(None))
            .correlate(User)
            .scalar_subquery()
        )
        last_workout = (
            select(func.max(Workout.finished_at))
            .where(Workout.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
        )
        query = (
            select(User, Crew, points, workouts, last_workout)
            .outerjoin(Membership, Membership.user_id == User.id)
            .outerjoin(Crew, Crew.id == Membership.crew_id)
            .order_by(User.created_at.desc())
            .limit(_MEMBERS_LIMIT)
        )
        if search:
            pattern = f"%{_escape_like(search)}%"
            query = query.where(
                or_(
                    User.email.ilike(pattern, escape="\\"),
                    User.display_name.ilike(pattern, escape="\\"),
                )
            )
        result = await self._session.execute(query)
        return [MemberRow(*row) for row in result.all()]

    async def remove_membership(self, user_id: uuid.UUID) -> None:
        """Take the user out of their crew. The account and history stay."""
        await self._session.execute(delete(Membership).where(Membership.user_id == user_id))

    async def log(self, action: AdminAction) -> None:
        """Add a row to the audit log."""
        self._session.add(action)
        await self._session.flush()

    async def actions(self) -> list[AdminAction]:
        """The newest audit log rows."""
        result = await self._session.execute(
            select(AdminAction).order_by(AdminAction.created_at.desc()).limit(_ACTIONS_LIMIT)
        )
        return list(result.scalars())


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
