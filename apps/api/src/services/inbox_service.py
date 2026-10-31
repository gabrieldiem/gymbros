"""The notifications inbox."""

from collections.abc import Callable
from datetime import datetime

from db.repositories.notification_repository import NotificationRepository
from db.repositories.user_repository import UserRepository
from db.tables.user import User
from services.social_types import Inbox, InboxEntry

INBOX_SIZE = 30


class InboxService:
    """Lists and marks notifications."""

    def __init__(
        self,
        notifications: NotificationRepository,
        users: UserRepository,
        now: Callable[[], datetime],
    ) -> None:
        self._notifications = notifications
        self._users = users
        self._now = now

    async def inbox(self, user: User) -> Inbox:
        """The newest notifications with their actors, and the unread count."""
        latest = await self._notifications.latest(user.id, INBOX_SIZE)
        actors = await self._users.get_many({n.actor_id for n in latest if n.actor_id})
        return Inbox(
            entries=tuple(
                InboxEntry(n, actors.get(n.actor_id) if n.actor_id else None) for n in latest
            ),
            unread=await self._notifications.unread_count(user.id),
        )

    async def mark_all_read(self, user: User) -> None:
        """Everything in the inbox is read now."""
        await self._notifications.mark_all_read(user.id, self._now())
