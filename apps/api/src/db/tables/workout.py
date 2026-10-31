"""workouts: one logged gym session. In progress while finished_at is null."""

# astroid mis-infers `Mapped` as unsubscriptable for these modules in a full-package run
# (not when linted alone). Typing is checked by mypy.
# pylint: disable=unsubscriptable-object

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from db.tables.workout_set import WorkoutSet


class Workout(Base):  # pylint: disable=too-few-public-methods
    """A workout. Points, volume and week are set when it is finished."""

    __tablename__ = "workouts"
    __table_args__ = (
        # At most one in-progress workout per user.
        Index(
            "uq_workouts_user_id_active",
            "user_id",
            unique=True,
            postgresql_where=text("finished_at IS NULL"),
        ),
        Index("ix_workouts_crew_id_week_start", "crew_id", "week_start"),
        Index("ix_workouts_user_id_finished_at", "user_id", "finished_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    crew_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("crews.id", ondelete="CASCADE"))
    routine_id: Mapped[str | None] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(60))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    week_start: Mapped[date | None] = mapped_column(Date)
    volume_kg: Mapped[float | None] = mapped_column(Float)
    points: Mapped[int | None] = mapped_column(Integer)

    sets: Mapped[list[WorkoutSet]] = relationship(
        cascade="all, delete-orphan",
        order_by=(WorkoutSet.exercise_position, WorkoutSet.set_position),
        lazy="selectin",
    )
