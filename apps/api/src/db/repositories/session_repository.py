"""SQL for auth sessions."""

import uuid
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.auth_session import AuthSession


class SessionRepository:
    """Reads and writes `auth_sessions`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, token_hash: str, user_id: uuid.UUID, expires_at: datetime) -> None:
        """Store a new session."""
        self._session.add(
            AuthSession(token_hash=token_hash, user_id=user_id, expires_at=expires_at)
        )
        await self._session.flush()

    async def get_user_id(self, token_hash: str, now: datetime) -> uuid.UUID | None:
        """The user of an unexpired session, if any."""
        result = await self._session.execute(
            select(AuthSession.user_id).where(
                AuthSession.token_hash == token_hash, AuthSession.expires_at > now
            )
        )
        return result.scalar_one_or_none()

    async def delete(self, token_hash: str) -> None:
        """End a session. Unknown hashes are ignored."""
        await self._session.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash))

    async def delete_expired(self, now: datetime) -> None:
        """Delete every session that has expired (they are already ignored by lookups)."""
        await self._session.execute(delete(AuthSession).where(AuthSession.expires_at <= now))
