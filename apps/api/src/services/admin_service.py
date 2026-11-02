"""The backoffice's rules. Routes check the caller is an admin; every change here is audited."""

import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.exc import IntegrityError

from db.repositories.admin_repository import AdminRepository
from db.repositories.crew_repository import CrewRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.user_repository import UserRepository
from db.tables.admin_action import AdminAction
from db.tables.crew import Crew
from db.tables.point_event import PointEvent
from db.tables.user import User
from services.admin_types import CrewRow, InviteSent, MemberRow, Overview
from services.crew_service import CrewService, invite_status, require_usable_invite
from services.errors import (
    AlreadyInThisCrew,
    CannotDeleteSelf,
    CrewNotFound,
    InviteCodeTaken,
    InviteExpiryInPast,
    MemberHasNoCrew,
    MemberInOtherCrew,
    MemberNotFound,
)
from services.invite_email import invite_email, invite_link
from services.profile_rules import (
    new_invite_code,
    validate_custom_invite_code,
    validate_time_zone,
)
from services.training_rules import week_start
from services.welcome_email import EmailSender
from services.notifier import Notifier

ADJUSTMENT_KEY = "ln_admin"
_RECENT = timedelta(days=7)


class AdminService:
    # pylint: disable=too-many-instance-attributes
    """Reads across every crew and makes audited changes."""

    def __init__(
        self,
        repos: tuple[AdminRepository, UserRepository, CrewRepository, PointEventRepository],
        now: Callable[[], datetime],
        email: EmailSender,
        public_url: str,
        notifier: Notifier,
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._admin, self._users, self._crews, self._events = repos
        self._email = email
        self._public_url = public_url
        self._notifier = notifier
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

    def invite_status(self, crew: Crew) -> str:
        """Whether a crew's invite code can be used right now."""
        return invite_status(crew, self._now())

    async def create_crew(
        self, admin: User, name: str, time_zone: str, invite: dict[str, Any]
    ) -> Crew:
        """Create a crew, with a chosen invite code and limits or a random code and none."""
        code = await self._free_code(invite.get("invite_code"), None)
        crew = await self._crew_service.create(name, time_zone, code)
        self._apply_limits(crew, invite)
        await self._save(crew)
        await self._audit(admin, "crew_created", crew.id, {"name": crew.name})
        return crew

    async def update_crew(self, admin: User, crew_id: uuid.UUID, changes: dict[str, Any]) -> Crew:
        """Change only the fields sent. A limit sent as null removes that limit."""
        crew = await self._crew(crew_id)
        if changes.get("name") is not None:
            crew.name = changes["name"].strip()
        if changes.get("time_zone") is not None:
            crew.time_zone = validate_time_zone(changes["time_zone"])
        if changes.get("invite_code") is not None:
            code = await self._free_code(changes["invite_code"], crew.id)
            if code != crew.invite_code:
                crew.invite_code = code or crew.invite_code
                crew.invite_uses = 0
        self._apply_limits(crew, changes)
        await self._save(crew)
        await self._audit(admin, "crew_updated", crew.id, {"name": crew.name})
        return crew

    def _apply_limits(self, crew: Crew, changes: dict[str, Any]) -> None:
        if "invite_max_uses" in changes:
            crew.invite_max_uses = changes["invite_max_uses"]
        if "invite_expires_at" in changes:
            expires = changes["invite_expires_at"]
            if expires is not None and expires <= self._now():
                raise InviteExpiryInPast(str(expires))
            crew.invite_expires_at = expires

    async def _free_code(self, raw: str | None, crew_id: uuid.UUID | None) -> str | None:
        """A chosen code, checked and not used by another crew. None if none was chosen."""
        if raw is None:
            return None
        code = validate_custom_invite_code(raw)
        holder = await self._crews.get_by_invite_code(code)
        if holder is not None and holder.id != crew_id:
            raise InviteCodeTaken(code)
        return code

    async def _save(self, crew: Crew) -> None:
        """Two admins picking the same code at once: the unique constraint decides."""
        try:
            await self._crews.save(crew)
        except IntegrityError as error:
            raise InviteCodeTaken(crew.invite_code) from error

    async def send_invite(
        self, admin: User, crew_id: uuid.UUID, email: str, language: str
    ) -> InviteSent:
        """Email the crew's invite link. It works for a new account or one without a crew."""
        crew = await self._crew(crew_id)
        require_usable_invite(crew, self._now())
        address = email.strip().lower()
        existing = await self._users.get_by_email(address)
        if existing is not None:
            await self._require_free(existing, crew)
            language = existing.language
        link = invite_link(self._public_url, crew.invite_code)
        sent = await self._email.send(
            invite_email(address, admin.display_name, crew.name, language, link)
        )
        await self._audit(admin, "invite_sent", crew.id, {"name": crew.name})
        return InviteSent(sent, link, existing is not None)

    async def _require_free(self, user: User, crew: Crew) -> None:
        current = await self._crews.get_crew_of(user.id)
        if current is None:
            return
        if current.id == crew.id:
            raise AlreadyInThisCrew(str(user.id))
        raise MemberInOtherCrew(str(user.id))

    async def rotate_invite_code(self, admin: User, crew_id: uuid.UUID) -> Crew:
        """Replace the invite code. The old one stops working; existing members stay."""
        crew = await self._crew(crew_id)
        crew.invite_code = new_invite_code()
        crew.invite_uses = 0
        await self._save(crew)
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
        await self._notifier.send(
            [user.id],
            None,
            "n_points_adjusted",
            {"points": points, "reason": reason.strip()},
            "/me",
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
