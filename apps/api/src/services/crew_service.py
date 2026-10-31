"""Crews: create one, join one by invite code."""

from db.repositories.crew_repository import CrewRepository
from db.tables.crew import Crew
from db.tables.user import User
from services.errors import AlreadyInCrew, InviteCodeNotFound
from services.profile_rules import (
    new_invite_code,
    normalize_invite_code,
    pick_color,
    validate_time_zone,
)


class CrewService:
    """Crew creation and membership."""

    def __init__(self, crews: CrewRepository) -> None:
        self._crews = crews

    async def create(self, name: str, time_zone: str, invite_code: str | None = None) -> Crew:
        """Create a crew. A random invite code is generated unless one is given."""
        code = normalize_invite_code(invite_code) if invite_code else new_invite_code()
        crew = Crew(name=name.strip(), time_zone=validate_time_zone(time_zone), invite_code=code)
        return await self._crews.add(crew)

    async def find_by_code(self, invite_code: str) -> Crew:
        """The crew for a (loosely typed) invite code, or InviteCodeNotFound."""
        crew = await self._crews.get_by_invite_code(normalize_invite_code(invite_code))
        if crew is None:
            raise InviteCodeNotFound(invite_code)
        return crew

    async def join(self, user: User, crew: Crew) -> Crew:
        """Add the user to the crew and give them the first free palette color."""
        if await self._crews.get_crew_of(user.id) is not None:
            raise AlreadyInCrew(str(user.id))
        user.color = pick_color(await self._crews.member_colors(crew.id))
        await self._crews.add_member(crew.id, user.id)
        return crew

    async def join_by_code(self, user: User, invite_code: str) -> Crew:
        """Join the crew that owns this invite code."""
        return await self.join(user, await self.find_by_code(invite_code))
