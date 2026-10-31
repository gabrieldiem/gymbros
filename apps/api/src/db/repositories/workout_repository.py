"""SQL for workouts and their sets."""

import uuid
from collections import defaultdict
from datetime import date, datetime

from sqlalchemy import and_, func, select, tuple_
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.membership import Membership
from db.tables.user import User
from db.tables.workout import Workout
from db.tables.workout_set import WorkoutSet


class WorkoutRepository:
    """Reads and writes `workouts` and `workout_sets`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, workout_id: uuid.UUID) -> Workout | None:
        """The workout with its sets, if any."""
        return await self._session.get(Workout, workout_id)

    async def get_active(self, user_id: uuid.UUID) -> Workout | None:
        """The user's in-progress workout, if any."""
        result = await self._session.execute(
            select(Workout).where(Workout.user_id == user_id, Workout.finished_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def add(self, workout: Workout) -> Workout:
        """Insert a workout with its sets."""
        self._session.add(workout)
        await self._session.flush()
        return workout

    async def save(self, workout: Workout) -> Workout:
        """Flush changes to a loaded workout (sets included)."""
        await self._session.flush()
        await self._session.refresh(workout, ["sets"])
        return workout

    async def delete(self, workout: Workout) -> None:
        """Remove a workout and its sets."""
        await self._session.delete(workout)
        await self._session.flush()

    async def last_sets(
        self, user_id: uuid.UUID, exercise_ids: list[str]
    ) -> dict[str, list[WorkoutSet]]:
        """Per exercise, the sets from the user's most recent finished workout that had it."""
        latest = (
            select(WorkoutSet.exercise_id, WorkoutSet.workout_id)
            .join(Workout, Workout.id == WorkoutSet.workout_id)
            .where(
                Workout.user_id == user_id,
                Workout.finished_at.is_not(None),
                WorkoutSet.exercise_id.in_(exercise_ids),
            )
            .ext(distinct_on(WorkoutSet.exercise_id))
            .order_by(WorkoutSet.exercise_id, Workout.finished_at.desc())
        )
        pairs = [tuple(row) for row in (await self._session.execute(latest)).all()]
        if not pairs:
            return {}
        result = await self._session.execute(
            select(WorkoutSet)
            .where(tuple_(WorkoutSet.exercise_id, WorkoutSet.workout_id).in_(pairs))
            .order_by(WorkoutSet.set_position)
        )
        by_exercise: dict[str, list[WorkoutSet]] = defaultdict(list)
        for workout_set in result.scalars():
            by_exercise[workout_set.exercise_id].append(workout_set)
        return dict(by_exercise)

    async def previous_routine_volume(self, user_id: uuid.UUID, routine_id: str) -> float | None:
        """Volume of the user's last finished workout of this routine."""
        result = await self._session.execute(
            select(Workout.volume_kg)
            .where(
                Workout.user_id == user_id,
                Workout.routine_id == routine_id,
                Workout.finished_at.is_not(None),
            )
            .order_by(Workout.finished_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def count_by_week(self, user_id: uuid.UUID, since: date) -> dict[date, int]:
        """Finished workouts per crew-local week, from `since` on."""
        result = await self._session.execute(
            select(Workout.week_start, func.count())
            .where(
                Workout.user_id == user_id,
                Workout.finished_at.is_not(None),
                Workout.week_start >= since,
            )
            .group_by(Workout.week_start)
        )
        return {week: count for week, count in result.all() if week is not None}

    async def active_in_crew(self, crew_id: uuid.UUID) -> list[tuple[Workout, User]]:
        """In-progress workouts of the crew's members, oldest first."""
        result = await self._session.execute(
            select(Workout, User)
            .join(User, User.id == Workout.user_id)
            .join(
                Membership,
                and_(Membership.user_id == User.id, Membership.crew_id == crew_id),
            )
            .where(Workout.finished_at.is_(None))
            .order_by(Workout.started_at)
        )
        return [(row[0], row[1]) for row in result.all()]

    async def counts_by_user_and_week(
        self, crew_id: uuid.UUID, since: date
    ) -> dict[uuid.UUID, dict[date, int]]:
        """Finished workouts per member and crew-local week, from `since` on."""
        result = await self._session.execute(
            select(Workout.user_id, Workout.week_start, func.count())
            .where(
                Workout.crew_id == crew_id,
                Workout.finished_at.is_not(None),
                Workout.week_start >= since,
            )
            .group_by(Workout.user_id, Workout.week_start)
        )
        counts: dict[uuid.UUID, dict[date, int]] = defaultdict(dict)
        for user_id, week, count in result.all():
            if week is not None:
                counts[user_id][week] = count
        return dict(counts)

    async def volume_by_week(self, user_id: uuid.UUID, since: date) -> dict[date, float]:
        """Volume lifted per crew-local week, from `since` on."""
        result = await self._session.execute(
            select(Workout.week_start, func.sum(Workout.volume_kg))
            .where(
                Workout.user_id == user_id,
                Workout.finished_at.is_not(None),
                Workout.week_start >= since,
            )
            .group_by(Workout.week_start)
        )
        return {week: float(volume or 0) for week, volume in result.all() if week is not None}

    async def completed_lifts_before(
        self, user_id: uuid.UUID, exercise_ids: list[str], before: datetime
    ) -> list[tuple[str, float, int]]:
        """(exercise, load, reps) of checked sets in workouts finished before `before`."""
        result = await self._session.execute(
            select(WorkoutSet.exercise_id, WorkoutSet.load_kg, WorkoutSet.reps)
            .join(Workout, Workout.id == WorkoutSet.workout_id)
            .where(
                Workout.user_id == user_id,
                Workout.finished_at < before,
                WorkoutSet.exercise_id.in_(exercise_ids),
                WorkoutSet.done.is_(True),
                WorkoutSet.reps > 0,
            )
        )
        return [(ex, float(load or 0), int(reps or 0)) for ex, load, reps in result.all()]

    async def last_finished_by_user(self, crew_id: uuid.UUID) -> dict[uuid.UUID, datetime]:
        """When each member of the crew last finished a workout."""
        result = await self._session.execute(
            select(Workout.user_id, func.max(Workout.finished_at))
            .where(Workout.crew_id == crew_id, Workout.finished_at.is_not(None))
            .group_by(Workout.user_id)
        )
        return {user_id: last for user_id, last in result.all() if last is not None}

    async def best_session(self, crew_id: uuid.UUID) -> tuple[uuid.UUID, int] | None:
        """(user, points) of the crew's highest-scoring workout."""
        result = await self._session.execute(
            select(Workout.user_id, Workout.points)
            .where(Workout.crew_id == crew_id, Workout.points.is_not(None))
            .order_by(Workout.points.desc())
            .limit(1)
        )
        row = result.first()
        return (row[0], int(row[1] or 0)) if row else None
