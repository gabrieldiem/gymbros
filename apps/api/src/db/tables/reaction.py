"""reactions: 👊 (fist) or 🔥 (fire) on a feed item, one of each per member."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Reaction(Base):  # pylint: disable=too-few-public-methods
    """A member's reaction. Toggling it off deletes the row."""

    __tablename__ = "reactions"

    feed_item_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("feed_items.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    kind: Mapped[str] = mapped_column(String(8), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
