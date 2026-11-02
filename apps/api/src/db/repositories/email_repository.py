"""SQL for email settings, who gets email, and the digest's record of who it went to."""

import uuid
from datetime import date, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.crew import Crew
from db.tables.digest_send import DigestSend
from db.tables.email_settings import SETTINGS_ID, EmailSettings
from db.tables.membership import Membership
from db.tables.user import User


class EmailRepository:
    """Reads and writes everything about email except sending it."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def settings(self) -> EmailSettings:
        """The settings, created with their defaults the first time."""
        await self._session.execute(
            insert(EmailSettings)
            .values(id=SETTINGS_ID, welcome_enabled=True, digest_enabled=False, digest_hour=9)
            .on_conflict_do_nothing(index_elements=["id"])
        )
        settings = await self._session.get(EmailSettings, SETTINGS_ID)
        assert settings is not None
        return settings

    async def save(self) -> None:
        """Flush changes to the loaded settings."""
        await self._session.flush()

    async def crews(self) -> list[Crew]:
        """Every crew."""
        return list((await self._session.scalars(select(Crew))).all())

    async def recipients(self, crew_id: uuid.UUID | None) -> list[User]:
        """Who hasn't turned off email updates: everyone, or one crew."""
        query = select(User).where(User.email_updates.is_(True))
        if crew_id is not None:
            query = query.join(Membership, Membership.user_id == User.id).where(
                Membership.crew_id == crew_id
            )
        return list((await self._session.scalars(query)).all())

    async def claim_digest(self, user_id: uuid.UUID, week: date, now: datetime) -> bool:
        """Claim this member's digest for the week. Only one claim ever succeeds."""
        result = await self._session.execute(
            insert(DigestSend)
            .values(user_id=user_id, week_start=week, sent_at=now)
            .on_conflict_do_nothing(index_elements=["user_id", "week_start"])
            .returning(DigestSend.user_id)
        )
        return result.first() is not None

    async def release_digest(self, user_ids: list[uuid.UUID], week: date) -> None:
        """Give claims back after a send that failed, so the next run tries again."""
        await self._session.execute(
            delete(DigestSend).where(
                DigestSend.user_id.in_(user_ids), DigestSend.week_start == week
            )
        )

    async def digests_sent(self, since: date) -> int:
        """How many digests have gone out since then."""
        count = await self._session.scalar(
            select(func.count()).select_from(DigestSend).where(DigestSend.week_start >= since)
        )
        return int(count or 0)
