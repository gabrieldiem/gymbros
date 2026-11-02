"""admin_actions: the audit log. One row per change made through the backoffice."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class AdminAction(Base):  # pylint: disable=too-few-public-methods
    """Who did what. Targets are ids, so deleting an account leaves none of its personal data."""

    __tablename__ = "admin_actions"
    __table_args__ = (Index("ix_admin_actions_created_at", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    admin_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    admin_email: Mapped[str] = mapped_column(String(254))
    action: Mapped[str] = mapped_column(String(32))
    target: Mapped[str] = mapped_column(String(64))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
