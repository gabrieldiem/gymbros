"""memberships: which crew a user belongs to. One crew per user (user_id is the key)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Membership(Base):  # pylint: disable=too-few-public-methods
    """A member: a user inside a crew."""

    __tablename__ = "memberships"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    crew_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("crews.id", ondelete="CASCADE"), index=True
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
