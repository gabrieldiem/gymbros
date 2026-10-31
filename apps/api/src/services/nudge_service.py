"""Nudges: poke a member who hasn't trained in a while. One per member per day."""

import uuid
from collections.abc import Callable
from datetime import datetime, timedelta

from db.repositories.crew_repository import CrewRepository
from db.repositories.notification_repository import NotificationRepository
from db.tables.user import User
from services.errors import AlreadyNudged, CannotNudgeSelf, MemberNotFound
from services.member import Member
from services.notifier import Notifier

NUDGE_KEY = "n_nudge"
_COOLDOWN = timedelta(days=1)


class NudgeService:
    """Sends nudges."""

    def __init__(
        self,
        crews: CrewRepository,
        notifications: NotificationRepository,
        notifier: Notifier,
        now: Callable[[], datetime],
    ) -> None:
        self._crews = crews
        self._notifications = notifications
        self._notifier = notifier
        self._now = now

    async def nudge(self, member: Member, target_id: uuid.UUID) -> User:
        """Nudge a crew mate. Returns who was nudged."""
        if target_id == member.user.id:
            raise CannotNudgeSelf(str(target_id))
        target = next(
            (u for u in await self._crews.members(member.crew.id) if u.id == target_id), None
        )
        if target is None:
            raise MemberNotFound(str(target_id))
        since = self._now() - _COOLDOWN
        if await self._notifications.sent_since(NUDGE_KEY, member.user.id, target_id, since):
            raise AlreadyNudged(str(target_id))
        name = {"name": member.user.display_name}
        await self._notifier.send([target_id], member.user.id, NUDGE_KEY, name, "/train")
        return target
