"""The notifications inbox."""

from collections.abc import Callable, Sequence
from datetime import datetime, timedelta

from db.repositories.notification_repository import NotificationRepository
from db.repositories.user_repository import UserRepository
from db.tables.user import User
from services.notifier import Notifier
from services.social_types import Inbox, InboxEntry
from services.whats_new import WhatsNewEntry, unseen_entries

INBOX_SIZE = 30
WHATS_NEW_KEY = "n_whats_new"
WHATS_NEW_LINK = "/whats-new"


class InboxService:
    """Lists and marks notifications."""

    def __init__(
        self,
        notifications: NotificationRepository,
        users: UserRepository,
        now: Callable[[], datetime],
        keep_days: int,
        whats_new: Sequence[WhatsNewEntry] = (),
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._whats_new = whats_new
        self._notifications = notifications
        self._users = users
        self._now = now
        self._keep = timedelta(days=keep_days)

    async def inbox(self, user: User) -> Inbox:
        """The newest notifications with their actors, and the unread count."""
        await self._deliver_whats_new(user)
        latest = await self._notifications.latest(user.id, INBOX_SIZE)
        actors = await self._users.get_many({n.actor_id for n in latest if n.actor_id})
        return Inbox(
            entries=tuple(
                InboxEntry(n, actors.get(n.actor_id) if n.actor_id else None) for n in latest
            ),
            unread=await self._notifications.unread_count(user.id),
        )

    async def _deliver_whats_new(self, user: User) -> None:
        """One notification for everything new since last time, however much that is, and once."""
        unseen = unseen_entries(self._whats_new, user.whats_new_seen, user.created_at)
        if not unseen:
            return
        if await self._users.claim_whats_new(user.id, user.whats_new_seen, unseen[0].id):
            await Notifier(self._notifications, self._now).send(
                [user.id],
                None,
                WHATS_NEW_KEY,
                {"n": len(unseen), "feature": unseen[0].id},
                WHATS_NEW_LINK,
            )

    async def mark_all_read(self, user: User) -> None:
        """Everything in the inbox is read now, and notifications past `keep_days` are deleted."""
        now = self._now()
        await self._notifications.mark_all_read(user.id, now)
        await self._notifications.delete_older_than(user.id, now - self._keep)
