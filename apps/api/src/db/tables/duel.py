"""duels: a 1v1 until Sunday night, by points or bench volume, with a stake."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Duel(Base):  # pylint: disable=too-few-public-methods
    """pending → active (accepted) → settled; or pending → declined."""

    __tablename__ = "duels"
    __table_args__ = (Index("ix_duels_crew_id_week_start", "crew_id", "week_start"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    crew_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("crews.id", ondelete="CASCADE"))
    challenger_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE")
    )
    opponent_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    metric: Mapped[str] = mapped_column(String(16))
    stake_key: Mapped[str] = mapped_column(String(16))
    week_start: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    winner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
