"""step_entries: steps for one day or several, as a member logged them."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class StepEntry(Base):  # pylint: disable=too-few-public-methods
    """A total of steps across crew-local days, both ends included. Its points are point events."""

    __tablename__ = "step_entries"
    __table_args__ = (Index("ix_step_entries_user_id_start_date", "user_id", "start_date"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    crew_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("crews.id", ondelete="CASCADE"), index=True
    )
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    steps: Mapped[int] = mapped_column(Integer)
    points: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
