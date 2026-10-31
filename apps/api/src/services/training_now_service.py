"""Training now: crew members with a workout in progress and what they are on."""

from dataclasses import dataclass

from db.repositories.workout_repository import WorkoutRepository
from db.tables.user import User
from db.tables.workout import Workout
from services.member import Member


@dataclass(frozen=True, slots=True)
class ActiveWorkout:
    """A member who is training right now."""

    user: User
    workout: Workout
    current_exercise_id: str | None


class TrainingNowService:
    """Lists in-progress workouts in the member's crew."""

    def __init__(self, workouts: WorkoutRepository) -> None:
        self._workouts = workouts

    async def list(self, member: Member) -> list[ActiveWorkout]:
        """Everyone in the crew with a workout in progress (including the member)."""
        rows = await self._workouts.active_in_crew(member.crew.id)
        return [ActiveWorkout(user, workout, current_exercise(workout)) for workout, user in rows]


def current_exercise(workout: Workout) -> str | None:
    """The first exercise with an unchecked set, else the last one logged."""
    pending = next((s.exercise_id for s in workout.sets if not s.done), None)
    if pending is not None:
        return pending
    return workout.sets[-1].exercise_id if workout.sets else None
