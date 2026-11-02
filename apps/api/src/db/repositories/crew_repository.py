"""SQL for crews and memberships."""

import uuid
from datetime import datetime

from sqlalchemy import or_, select, update
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

    async def consume_invite(self, crew_id: uuid.UUID, now: datetime) -> bool:
        """Count one use if the code still has one. One atomic UPDATE, so two people can't both
        take the last use."""
        result = await self._session.execute(
            update(Crew)
            .where(
                Crew.id == crew_id,
                or_(Crew.invite_max_uses.is_(None), Crew.invite_uses < Crew.invite_max_uses),
                or_(Crew.invite_expires_at.is_(None), Crew.invite_expires_at > now),
            )
            .values(invite_uses=Crew.invite_uses + 1)
            .returning(Crew.id)
        )
        return result.first() is not None

    async def refresh(self, crew: Crew) -> None:
        """Reload a crew's columns from the database."""
        await self._session.refresh(crew)

    async def save(self, crew: Crew) -> Crew:
        """Flush changes to a loaded crew, so a constraint failure surfaces here."""
        await self._session.flush()
        return crew

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

    async def delete(self, crew: Crew) -> None:
        """Remove a crew; memberships, workouts and point events cascade."""
        await self._session.delete(crew)
        await self._session.flush()
