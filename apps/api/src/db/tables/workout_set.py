"""workout_sets: one set of one exercise inside a workout."""

# astroid mis-infers `Mapped` as unsubscriptable for these modules in a full-package run
# (not when linted alone). Typing is checked by mypy.
# pylint: disable=unsubscriptable-object

import uuid

from sqlalchemy import BigInteger, Boolean, Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class WorkoutSet(Base):  # pylint: disable=too-few-public-methods
    """Load + reps, or minutes + km for cardio. `done` once checked off."""

    __tablename__ = "workout_sets"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    workout_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workouts.id", ondelete="CASCADE"), index=True
    )
    exercise_id: Mapped[str] = mapped_column(String(32), index=True)
    exercise_position: Mapped[int] = mapped_column(Integer)
    set_position: Mapped[int] = mapped_column(Integer)
    load_kg: Mapped[float | None] = mapped_column(Float)
    reps: Mapped[int | None] = mapped_column(Integer)
    minutes: Mapped[int | None] = mapped_column(Integer)
    km: Mapped[float | None] = mapped_column(Float)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
