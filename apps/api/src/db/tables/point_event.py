"""point_events: immutable scoring lines. Standings are sums over this table."""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Index, Integer, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class PointEvent(Base):  # pylint: disable=too-few-public-methods
    """One line item: an i18n key with variables and the points it paid."""

    __tablename__ = "point_events"
    __table_args__ = (
        Index("ix_point_events_crew_id_week_start", "crew_id", "week_start"),
        Index("ix_point_events_user_id_created_at", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    crew_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("crews.id", ondelete="CASCADE"))
    workout_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("workouts.id", ondelete="SET NULL"), index=True
    )
    key: Mapped[str] = mapped_column(String(40))
    vars: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    points: Mapped[int] = mapped_column(Integer)
    week_start: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
