"""workout_photos: one picture per workout, small enough to live in the database."""

# astroid mis-infers `Mapped` as unsubscriptable for these modules in a full-package run
# (not when linted alone). Typing is checked by mypy.
# pylint: disable=unsubscriptable-object

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class WorkoutPhoto(Base):  # pylint: disable=too-few-public-methods
    """A picture of the whole workout. It goes when the workout goes."""

    __tablename__ = "workout_photos"

    workout_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workouts.id", ondelete="CASCADE"), primary_key=True
    )
    image: Mapped[bytes] = mapped_column(LargeBinary)
    content_type: Mapped[str] = mapped_column(String(32))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
