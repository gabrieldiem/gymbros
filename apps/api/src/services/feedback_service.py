"""Feedback from members, for the people running the app."""

import uuid
from collections.abc import Callable
from datetime import datetime, timedelta

from db.repositories.admin_repository import AdminRepository
from db.repositories.feedback_repository import FeedbackRepository
from db.tables.admin_action import AdminAction
from db.tables.feedback import Feedback
from db.tables.user import User
from services.errors import FeedbackNotFound, TooMuchFeedback

DAILY_LIMIT = 10
INBOX_SIZE = 200
_A_DAY = timedelta(days=1)


class FeedbackService:
    """Takes messages from members and shows them to admins."""

    def __init__(
        self,
        feedback: FeedbackRepository,
        admin: AdminRepository,
        now: Callable[[], datetime],
    ) -> None:
        self._feedback = feedback
        self._admin = admin
        self._now = now

    async def send(self, user: User, kind: str, body: str) -> None:
        """Keep a message. A daily limit stops it filling the database."""
        now = self._now()
        if await self._feedback.count_since(user.id, now - _A_DAY) >= DAILY_LIMIT:
            raise TooMuchFeedback(str(user.id))
        await self._feedback.add(Feedback(user_id=user.id, kind=kind, body=body, created_at=now))

    async def inbox(self) -> list[tuple[Feedback, User]]:
        """The newest messages, for admins."""
        return await self._feedback.latest(INBOX_SIZE)

    async def set_handled(self, admin: User, feedback_id: uuid.UUID, handled: bool) -> Feedback:
        """Mark a message as dealt with, or not any more. Logged like any backoffice change."""
        feedback = await self._feedback.get(feedback_id)
        if feedback is None:
            raise FeedbackNotFound(str(feedback_id))
        now = self._now()
        feedback.handled_at = now if handled else None
        await self._feedback.save()
        await self._admin.log(
            AdminAction(
                admin_id=admin.id,
                admin_email=admin.email,
                action="feedback_handled" if handled else "feedback_reopened",
                target=str(feedback.id),
                details={},
                created_at=now,
            )
        )
        return feedback
