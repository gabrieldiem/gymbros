"""SQL for crews and memberships."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.crew import Crew
from db.tables.membership import Membership
from db.tables.user import User


class CrewRepository:
    """Reads and writes `crews` and `memberships`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, crew_id: uuid.UUID) -> Crew | None:
        """The crew with this id, if any."""
        return await self._session.get(Crew, crew_id)

    async def get_by_invite_code(self, invite_code: str) -> Crew | None:
        """The crew with this invite code, if any."""
        result = await self._session.execute(select(Crew).where(Crew.invite_code == invite_code))
        return result.scalar_one_or_none()

    async def add(self, crew: Crew) -> Crew:
        """Insert a crew and flush so its id is assigned."""
        self._session.add(crew)
        await self._session.flush()
        return crew

    async def get_crew_of(self, user_id: uuid.UUID) -> Crew | None:
        """The crew the user belongs to, if any."""
        result = await self._session.execute(
            select(Crew)
            .join(Membership, Membership.crew_id == Crew.id)
            .where(Membership.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def add_member(self, crew_id: uuid.UUID, user_id: uuid.UUID) -> None:
        """Put the user in the crew."""
        self._session.add(Membership(crew_id=crew_id, user_id=user_id))
        await self._session.flush()

    async def member_colors(self, crew_id: uuid.UUID) -> set[str]:
        """Colors already taken by members of the crew."""
        result = await self._session.execute(
            select(User.color)
            .join(Membership, Membership.user_id == User.id)
            .where(Membership.crew_id == crew_id)
        )
        return set(result.scalars())

    async def members(self, crew_id: uuid.UUID) -> list[User]:
        """Everyone in the crew."""
        result = await self._session.execute(
            select(User)
            .join(Membership, Membership.user_id == User.id)
            .where(Membership.crew_id == crew_id)
            .order_by(User.display_name)
        )
        return list(result.scalars())
