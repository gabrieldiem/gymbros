"""Writes notifications. Every notification is an i18n key + vars and an in-app link."""

import uuid
from collections.abc import Callable, Iterable
from datetime import datetime
from typing import Any

from db.repositories.notification_repository import NotificationRepository
from db.tables.notification import Notification


class Notifier:
    """Sends inbox entries to members."""

    def __init__(self, notifications: NotificationRepository, now: Callable[[], datetime]) -> None:
        self._notifications = notifications
        self._now = now

    async def send(
        self,
        user_ids: Iterable[uuid.UUID],
        actor_id: uuid.UUID | None,
        key: str,
        variables: dict[str, Any],
        link: str,
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        """One notification per recipient (never to the actor themself)."""
        now = self._now()
        await self._notifications.add_all(
            [
                Notification(
                    user_id=user_id,
                    actor_id=actor_id,
                    key=key,
                    vars=variables,
                    link=link,
                    created_at=now,
                )
                for user_id in user_ids
                if user_id != actor_id
            ]
        )
