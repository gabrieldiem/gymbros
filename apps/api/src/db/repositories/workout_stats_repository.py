"""SQL for workout statistics: badges, duels and the profile read these."""

import uuid
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.workout import Workout
from db.tables.workout_set import WorkoutSet


class WorkoutStatsRepository:
    """Aggregates over a member's finished workouts."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def finished_times(self, user_id: uuid.UUID) -> list[datetime]:
        """When each of the user's workouts finished."""
        result = await self._session.execute(
            select(Workout.finished_at).where(
                Workout.user_id == user_id, Workout.finished_at.is_not(None)
            )
        )
        return [moment for moment in result.scalars() if moment is not None]

    async def lifetime_volume(self, user_id: uuid.UUID) -> float:
        """Total kg the user has moved."""
        total = await self._session.scalar(
            select(func.sum(Workout.volume_kg)).where(
                Workout.user_id == user_id, Workout.finished_at.is_not(None)
            )
        )
        return float(total or 0)

    async def workouts_with(self, user_id: uuid.UUID, exercise_ids: list[str]) -> int:
        """Finished workouts with at least one completed set of these exercises."""
        count = await self._session.scalar(
            select(func.count(func.distinct(Workout.id)))
            .join(WorkoutSet, WorkoutSet.workout_id == Workout.id)
            .where(
                Workout.user_id == user_id,
                Workout.finished_at.is_not(None),
                WorkoutSet.exercise_id.in_(exercise_ids),
                WorkoutSet.done.is_(True),
            )
        )
        return int(count or 0)

    async def best_load(self, user_id: uuid.UUID, exercise_id: str) -> float:
        """The heaviest completed set of an exercise (≥ 1 rep)."""
        best = await self._session.scalar(
            select(func.max(WorkoutSet.load_kg))
            .join(Workout, Workout.id == WorkoutSet.workout_id)
            .where(
                Workout.user_id == user_id,
                Workout.finished_at.is_not(None),
                WorkoutSet.exercise_id == exercise_id,
                WorkoutSet.done.is_(True),
                WorkoutSet.reps > 0,
            )
        )
        return float(best or 0)

    async def exercise_volume_in_week(
        self, user_id: uuid.UUID, exercise_id: str, week_start: date
    ) -> float:
        """Σ load × reps of an exercise's completed sets in a week."""
        total = await self._session.scalar(
            select(func.sum(WorkoutSet.load_kg * WorkoutSet.reps))
            .join(Workout, Workout.id == WorkoutSet.workout_id)
            .where(
                Workout.user_id == user_id,
                Workout.week_start == week_start,
                Workout.finished_at.is_not(None),
                WorkoutSet.exercise_id == exercise_id,
                WorkoutSet.done.is_(True),
            )
        )
        return float(total or 0)

    async def recent_finished(self, user_id: uuid.UUID, limit: int) -> list[Workout]:
        """The user's latest finished workouts."""
        result = await self._session.execute(
            select(Workout)
            .where(Workout.user_id == user_id, Workout.finished_at.is_not(None))
            .order_by(Workout.finished_at.desc())
            .limit(limit)
        )
        return list(result.scalars())

    async def lift_sets_by_week(
        self, user_id: uuid.UUID, exercise_id: str, since: date
    ) -> list[tuple[date, float, int]]:
        """(week, load, reps) of every completed set of a lift since a week."""
        result = await self._session.execute(
            select(Workout.week_start, WorkoutSet.load_kg, WorkoutSet.reps)
            .join(Workout, Workout.id == WorkoutSet.workout_id)
            .where(
                Workout.user_id == user_id,
                Workout.finished_at.is_not(None),
                Workout.week_start >= since,
                WorkoutSet.exercise_id == exercise_id,
                WorkoutSet.done.is_(True),
                WorkoutSet.reps > 0,
            )
        )
        return [
            (week, float(load or 0), int(reps or 0))
            for week, load, reps in result.all()
            if week is not None
        ]

    async def completed_set_counts(self, workout_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        """Checked sets per workout."""
        if not workout_ids:
            return {}
        result = await self._session.execute(
            select(WorkoutSet.workout_id, func.count())
            .where(WorkoutSet.workout_id.in_(workout_ids), WorkoutSet.done.is_(True))
            .group_by(WorkoutSet.workout_id)
        )
        return {workout_id: int(count) for workout_id, count in result.all()}
