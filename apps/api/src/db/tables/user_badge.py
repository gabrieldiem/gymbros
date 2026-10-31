"""user_badges: badges a member has unlocked. Each badge pays once, ever."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class UserBadge(Base):  # pylint: disable=too-few-public-methods
    """An unlocked badge."""

    __tablename__ = "user_badges"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    badge_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
