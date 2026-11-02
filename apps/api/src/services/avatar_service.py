"""Uploaded profile pictures: yours to change, your crew's to see."""

import uuid
from collections.abc import Callable
from datetime import datetime

from db.repositories.avatar_repository import AvatarRepository
from db.repositories.crew_repository import CrewRepository
from db.repositories.user_repository import UserRepository
from db.tables.avatar import Avatar
from db.tables.user import User
from services.errors import AvatarNotFound
from services.images import MAX_AVATAR_BYTES, check_image


class AvatarService:
    """Stores pictures and decides who can see them."""

    def __init__(
        self,
        repos: tuple[AvatarRepository, UserRepository, CrewRepository],
        now: Callable[[], datetime],
        admin_emails: frozenset[str] = frozenset(),
    ) -> None:
        self._avatars, self._users, self._crews = repos
        self._now = now
        self._admin_emails = admin_emails

    async def upload(self, user: User, data: bytes) -> None:
        """Replace your picture. Raises if it's too big or isn't a picture."""
        content_type = check_image(data, MAX_AVATAR_BYTES)
        now = self._now()
        await self._avatars.store(
            Avatar(user_id=user.id, image=data, content_type=content_type, updated_at=now)
        )
        # Past the last version even if two uploads land in the same second.
        user.avatar_version = max(int(now.timestamp()), (user.avatar_version or 0) + 1)
        await self._users.save(user)

    async def remove(self, user: User) -> None:
        """Back to your characters."""
        await self._avatars.delete(user.id)
        user.avatar_version = None
        await self._users.save(user)

    async def view(self, viewer: User, user_id: uuid.UUID) -> Avatar:
        """The picture, for you, your crew and admins. Anyone else gets not found."""
        if not await self._may_see(viewer, user_id):
            raise AvatarNotFound(str(user_id))
        avatar = await self._avatars.get(user_id)
        if avatar is None:
            raise AvatarNotFound(str(user_id))
        return avatar

    async def _may_see(self, viewer: User, user_id: uuid.UUID) -> bool:
        if viewer.id == user_id or viewer.email.lower() in self._admin_emails:
            return True
        mine = await self._crews.get_crew_of(viewer.id)
        theirs = await self._crews.get_crew_of(user_id)
        return mine is not None and theirs is not None and mine.id == theirs.id
