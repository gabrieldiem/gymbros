"""digest_sends: who the weekly digest went to. The key is what stops anyone getting it twice."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class DigestSend(Base):  # pylint: disable=too-few-public-methods
    """One row per member and week, claimed before the email goes out."""

    __tablename__ = "digest_sends"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    week_start: Mapped[date] = mapped_column(Date, primary_key=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
