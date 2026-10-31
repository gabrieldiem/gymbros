"""comments: on a feed item. Either the member's own text or a quick-reply key."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Comment(Base):  # pylint: disable=too-few-public-methods
    """A comment. Quick replies store a key (rendered in each reader's language), not prose."""

    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    feed_item_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("feed_items.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str | None] = mapped_column(String(140))
    quick_key: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
