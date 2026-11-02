"""gyms: the places a member trains. One of them is the default."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Gym(Base):  # pylint: disable=too-few-public-methods
    """A named place. Workouts keep the name as it was, so this can change or go away."""

    __tablename__ = "gyms"
    __table_args__ = (
        Index("uq_gyms_user_id_name", "user_id", text("lower(name)"), unique=True),
        Index(
            "uq_gyms_user_id_default",
            "user_id",
            unique=True,
            postgresql_where=text("is_default"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(40))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
