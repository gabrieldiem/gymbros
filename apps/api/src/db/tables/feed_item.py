"""feed_items: what the crew sees in the Crew tab. Immutable snapshots with i18n keys + vars."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class FeedItem(Base):  # pylint: disable=too-few-public-methods
    """A finished workout, a rank-up or a badge, posted by `actor_id` to the crew."""

    __tablename__ = "feed_items"
    __table_args__ = (Index("ix_feed_items_crew_id_created_at", "crew_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    crew_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("crews.id", ondelete="CASCADE"))
    actor_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(16))
    workout_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("workouts.id", ondelete="SET NULL")
    )
    vars: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
