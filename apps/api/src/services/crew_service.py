"""Crews: create one, join one by invite code, within the code's limits."""

from collections.abc import Callable
from datetime import datetime

from clock import utc_now
from db.repositories.crew_repository import CrewRepository
from db.tables.crew import Crew
from db.tables.user import User
from services.errors import (
    AlreadyInCrew,
    InviteCodeExpired,
    InviteCodeNotFound,
    InviteCodeUsedUp,
)
from services.profile_rules import (
    new_invite_code,
    normalize_invite_code,
    pick_color,
    validate_time_zone,
)


def invite_status(crew: Crew, now: datetime) -> str:
    """Whether the crew's invite code can be used: `active`, `expired` or `used_up`."""
    if crew.invite_expires_at is not None and crew.invite_expires_at <= now:
        return "expired"
    if crew.invite_max_uses is not None and crew.invite_uses >= crew.invite_max_uses:
        return "used_up"
    return "active"


def require_usable_invite(crew: Crew, now: datetime) -> None:
    """Raise the reason the crew's invite code can't be used, if there is one."""
    status = invite_status(crew, now)
    if status == "expired":
        raise InviteCodeExpired(crew.invite_code)
    if status == "used_up":
        raise InviteCodeUsedUp(crew.invite_code)


class CrewService:
    """Crew creation and membership."""

    def __init__(self, crews: CrewRepository, now: Callable[[], datetime] = utc_now) -> None:
        self._crews = crews
        self._now = now

    async def create(self, name: str, time_zone: str, invite_code: str | None = None) -> Crew:
        """Create a crew. A random invite code is generated unless one is given."""
        code = normalize_invite_code(invite_code) if invite_code else new_invite_code()
        crew = Crew(name=name.strip(), time_zone=validate_time_zone(time_zone), invite_code=code)
        return await self._crews.add(crew)

    async def find_by_code(self, invite_code: str) -> Crew:
        """The crew for a (loosely typed) invite code that can still be used."""
        crew = await self._crews.get_by_invite_code(normalize_invite_code(invite_code))
        if crew is None:
            raise InviteCodeNotFound(invite_code)
        require_usable_invite(crew, self._now())
        return crew

    async def invite(self, invite_code: str) -> tuple[Crew, int]:
        """The crew behind an invite code and how many members it has."""
        crew = await self.find_by_code(invite_code)
        return crew, len(await self._crews.members(crew.id))

    async def join(self, user: User, crew: Crew) -> Crew:
        """Count a use of the invite, add the user and give them the first free palette color."""
        if await self._crews.get_crew_of(user.id) is not None:
            raise AlreadyInCrew(str(user.id))
        now = self._now()
        if not await self._crews.consume_invite(crew.id, now):
            # Someone else took the last use since it was checked.
            await self._crews.refresh(crew)
            require_usable_invite(crew, now)
            raise InviteCodeUsedUp(crew.invite_code)
        user.color = pick_color(await self._crews.member_colors(crew.id))
        await self._crews.add_member(crew.id, user.id)
        return crew

    async def join_by_code(self, user: User, invite_code: str) -> Crew:
        """Join the crew that owns this invite code."""
        return await self.join(user, await self.find_by_code(invite_code))
