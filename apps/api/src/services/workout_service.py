"""In-progress workouts: start (with overload pre-fill), save the logger state, discard, view."""

import uuid
from collections.abc import Callable
from datetime import datetime

from db.repositories.workout_repository import WorkoutRepository
from db.tables.workout import Workout
from services.catalog import Catalog, Exercise
from services.errors import (
    UnknownExercise,
    UnknownRoutine,
    WorkoutAlreadyActive,
    WorkoutAlreadyFinished,
    WorkoutNotFound,
)
from services.member import Member
from services.scoring_service import score_workout
from services.scoring_context import ScoringContextBuilder
from services.scoring_types import ScoringRules
from services.training_rules import LoggedSet, overload
from services.workout_mapping import to_entries, to_logged_set, to_rows, to_workout_log
from services.workout_types import ExerciseEntry, ExerciseView, WorkoutView

DEFAULT_SETS = 3


class WorkoutService:
    """Owns the lifecycle of a workout before it is finished."""

    def __init__(
        self,
        workouts: WorkoutRepository,
        context: ScoringContextBuilder,
        catalog: Catalog,
        rules: ScoringRules,
        now: Callable[[], datetime],
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._workouts = workouts
        self._context = context
        self._catalog = catalog
        self._rules = rules
        self._now = now

    async def start(self, member: Member, routine_id: str | None, name: str | None) -> WorkoutView:
        """Start a workout from a routine (pre-filled to beat last time) or empty."""
        if await self._workouts.get_active(member.user.id) is not None:
            raise WorkoutAlreadyActive(str(member.user.id))
        exercise_ids = self._routine_exercises(routine_id)
        entries = await self._prefilled(member, exercise_ids)
        workout = Workout(
            user_id=member.user.id,
            crew_id=member.crew.id,
            routine_id=routine_id,
            name=(name or self._routine_name(routine_id)).strip(),
            started_at=self._now(),
            sets=to_rows(entries),
        )
        return await self.view(member, await self._workouts.add(workout))

    async def get_active(self, member: Member) -> WorkoutView | None:
        """The member's in-progress workout, if any."""
        workout = await self._workouts.get_active(member.user.id)
        return await self.view(member, workout) if workout else None

    async def save(
        self,
        member: Member,
        workout_id: uuid.UUID,
        name: str | None,
        entries: tuple[ExerciseEntry, ...],
    ) -> WorkoutView:
        """Replace the logger state (exercises and sets) of an in-progress workout."""
        workout = await self.get_in_progress(member, workout_id)
        for entry in entries:
            self._exercise(entry.exercise_id)
        if name is not None:
            workout.name = name.strip()
        workout.sets = to_rows(entries)
        return await self.view(member, await self._workouts.save(workout))

    async def discard(self, member: Member, workout_id: uuid.UUID) -> None:
        """Throw away an in-progress workout."""
        await self._workouts.delete(await self.get_in_progress(member, workout_id))

    async def get_in_progress(self, member: Member, workout_id: uuid.UUID) -> Workout:
        """The member's own workout, still in progress."""
        workout = await self._workouts.get(workout_id)
        if workout is None or workout.user_id != member.user.id:
            raise WorkoutNotFound(str(workout_id))
        if workout.finished_at is not None:
            raise WorkoutAlreadyFinished(str(workout_id))
        return workout

    async def view(self, member: Member, workout: Workout) -> WorkoutView:
        """The workout with last time's sets and the live points if it were finished now."""
        entries = to_entries(workout)
        previous = await self._workouts.last_sets(
            member.user.id, list({e.exercise_id for e in entries})
        )
        exercises = tuple(
            ExerciseView(
                exercise_id=entry.exercise_id,
                sets=entry.sets,
                previous_sets=tuple(to_logged_set(r) for r in previous.get(entry.exercise_id, [])),
            )
            for entry in entries
        )
        return WorkoutView(
            workout=workout, exercises=exercises, live=await self._live(member, workout)
        )

    async def _live(self, member: Member, workout: Workout):
        log = to_workout_log(workout, self._catalog)
        history = await self._context.history(member, workout)
        week = await self._context.week(member, self._now())
        return score_workout(log, history, week, self._rules)

    async def _prefilled(
        self, member: Member, exercise_ids: list[str]
    ) -> tuple[ExerciseEntry, ...]:
        last = await self._workouts.last_sets(member.user.id, exercise_ids)
        return tuple(
            ExerciseEntry(
                exercise_id=ex_id, sets=self._next_sets(self._exercise(ex_id), last.get(ex_id, []))
            )
            for ex_id in exercise_ids
        )

    @staticmethod
    def _next_sets(exercise: Exercise, last_rows: list) -> tuple[LoggedSet, ...]:
        done = [to_logged_set(r) for r in last_rows if r.done]
        if done:
            return tuple(overload(exercise, s) for s in done)
        return tuple(LoggedSet() for _ in range(1 if exercise.is_cardio else DEFAULT_SETS))

    def _routine_exercises(self, routine_id: str | None) -> list[str]:
        if routine_id is None:
            return []
        routine = self._catalog.routine(routine_id)
        if routine is None:
            raise UnknownRoutine(routine_id)
        return list(routine.exercise_ids)

    def _routine_name(self, routine_id: str | None) -> str:
        routine = self._catalog.routine(routine_id) if routine_id else None
        return routine.name if routine else "Workout"

    def _exercise(self, exercise_id: str) -> Exercise:
        exercise = self._catalog.exercise(exercise_id)
        if exercise is None:
            raise UnknownExercise(exercise_id)
        return exercise
