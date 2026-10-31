"""personal_records: the best e1RM set per user and exercise."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class PersonalRecord(Base):  # pylint: disable=too-few-public-methods
    """A PR: the set with the highest estimated 1RM so far."""

    __tablename__ = "personal_records"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    exercise_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    load_kg: Mapped[float] = mapped_column(Float)
    reps: Mapped[int] = mapped_column(Integer)
    e1rm: Mapped[float] = mapped_column(Float)
    workout_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("workouts.id", ondelete="SET NULL")
    )
    achieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
