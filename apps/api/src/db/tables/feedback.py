"""feedback: what members tell the people running the app. It goes when the account goes."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Feedback(Base):  # pylint: disable=too-few-public-methods
    """An idea, a bug or anything else, for the backoffice."""

    __tablename__ = "feedback"
    __table_args__ = (
        Index("ix_feedback_created_at", "created_at"),
        Index("ix_feedback_user_id_created_at", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(8))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    handled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
