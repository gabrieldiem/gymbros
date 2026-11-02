"""The backoffice's rules. Routes check the caller is an admin; every change here is audited."""

import uuid
from collections.abc import Callable
from datetime import datetime, timedelta

from db.repositories.admin_repository import AdminRepository
from db.repositories.crew_repository import CrewRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.user_repository import UserRepository
from db.tables.admin_action import AdminAction
from db.tables.crew import Crew
from db.tables.point_event import PointEvent
from db.tables.user import User
from services.admin_types import CrewRow, MemberRow, Overview
from services.crew_service import CrewService
from services.errors import CannotDeleteSelf, CrewNotFound, MemberHasNoCrew, MemberNotFound
from services.profile_rules import new_invite_code, validate_time_zone
from services.training_rules import week_start

ADJUSTMENT_KEY = "ln_admin"
_RECENT = timedelta(days=7)


class AdminService:
    # pylint: disable=too-many-instance-attributes
    """Reads across every crew and makes audited changes."""

    def __init__(
        self,
        repos: tuple[AdminRepository, UserRepository, CrewRepository, PointEventRepository],
        now: Callable[[], datetime],
    ) -> None:
        self._admin, self._users, self._crews, self._events = repos
        self._crew_service = CrewService(self._crews)
        self._now = now

    async def overview(self) -> Overview:
        """Totals, and the last seven days."""
        return await self._admin.overview(self._now() - _RECENT)

    async def crews(self) -> list[CrewRow]:
        """Every crew."""
        return await self._admin.crews()

    async def members(self, search: str | None) -> list[MemberRow]:
        """Accounts, optionally filtered by name or email."""
        return await self._admin.members(search.strip() if search else None)

    async def actions(self) -> list[AdminAction]:
        """The audit log."""
        return await self._admin.actions()

    async def create_crew(self, admin: User, name: str, time_zone: str) -> Crew:
        """Create a crew with a random invite code."""
        crew = await self._crew_service.create(name, time_zone)
        await self._audit(admin, "crew_created", crew.id, {"name": crew.name})
        return crew

    async def update_crew(
        self, admin: User, crew_id: uuid.UUID, name: str | None, time_zone: str | None
    ) -> Crew:
        """Rename a crew or change its time zone."""
        crew = await self._crew(crew_id)
        if name is not None:
            crew.name = name.strip()
        if time_zone is not None:
            crew.time_zone = validate_time_zone(time_zone)
        await self._audit(admin, "crew_updated", crew.id, {"name": crew.name})
        return crew

    async def rotate_invite_code(self, admin: User, crew_id: uuid.UUID) -> Crew:
        """Replace the invite code. The old one stops working; existing members stay."""
        crew = await self._crew(crew_id)
        crew.invite_code = new_invite_code()
        await self._audit(admin, "crew_code_rotated", crew.id, {"name": crew.name})
        return crew

    async def adjust_points(
        self, admin: User, user_id: uuid.UUID, points: int, reason: str
    ) -> None:
        """Add or remove points with a reason. They count like any other point event."""
        user = await self._user(user_id)
        crew = await self._crews.get_crew_of(user.id)
        if crew is None:
            raise MemberHasNoCrew(str(user_id))
        now = self._now()
        event = PointEvent(
            user_id=user.id,
            crew_id=crew.id,
            key=ADJUSTMENT_KEY,
            vars={"reason": reason.strip()},
            points=points,
            week_start=week_start(now, crew.time_zone),
            created_at=now,
        )
        await self._events.add_all([event])
        await self._audit(
            admin, "points_adjusted", user.id, {"points": points, "reason": reason.strip()}
        )

    async def remove_from_crew(self, admin: User, user_id: uuid.UUID) -> None:
        """Take a member out of their crew so they can join another. Their history stays."""
        user = await self._user(user_id)
        await self._admin.remove_membership(user.id)
        await self._audit(admin, "member_removed", user.id, {})

    async def delete_account(self, admin: User, user_id: uuid.UUID) -> None:
        """Delete an account and everything in it. Admins can't delete themselves here."""
        if user_id == admin.id:
            raise CannotDeleteSelf(str(user_id))
        user = await self._user(user_id)
        await self._users.delete(user)
        await self._audit(admin, "account_deleted", user_id, {})

    async def _audit(
        self, admin: User, action: str, target: uuid.UUID, details: dict[str, object]
    ) -> None:
        await self._admin.log(
            AdminAction(
                admin_id=admin.id,
                admin_email=admin.email,
                action=action,
                target=str(target),
                details=details,
                created_at=self._now(),
            )
        )

    async def _crew(self, crew_id: uuid.UUID) -> Crew:
        crew = await self._crews.get(crew_id)
        if crew is None:
            raise CrewNotFound(str(crew_id))
        return crew

    async def _user(self, user_id: uuid.UUID) -> User:
        user = await self._users.get(user_id)
        if user is None:
            raise MemberNotFound(str(user_id))
        return user
