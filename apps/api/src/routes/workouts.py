"""Start, log, finish and discard workouts. Points are only computed on the server."""

import uuid

from fastapi import APIRouter, Depends, status

from clock import utc_now
from dependencies import (
    get_current_member,
    get_scoring_context,
    get_settings,
    get_workout_finisher,
    get_workout_service,
)
from models.errors import error_responses
from models.workout_mappers import to_finish_response, to_workout_response
from models.workouts import (
    FinishResponse,
    SaveWorkoutRequest,
    StartWorkoutRequest,
    WeekResponse,
    WorkoutResponse,
)
from services.member import Member
from services.scoring_context import ScoringContextBuilder
from services.training_rules import LoggedSet
from services.workout_finisher import WorkoutFinisher
from services.workout_service import WorkoutService
from services.workout_types import ExerciseEntry
from settings import Settings

router = APIRouter(prefix="/workouts", tags=["Train"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=WorkoutResponse,
    responses=error_responses(401, 403, 409, 422),
)
async def start_workout(
    body: StartWorkoutRequest,
    member: Member = Depends(get_current_member),
    workouts: WorkoutService = Depends(get_workout_service),
) -> WorkoutResponse:
    """Start a workout from a routine (pre-filled to beat last time) or empty."""
    return to_workout_response(await workouts.start(member, body.routine_id, body.name))


@router.get("/active", response_model=WorkoutResponse | None, responses=error_responses(401, 403))
async def get_active_workout(
    member: Member = Depends(get_current_member),
    workouts: WorkoutService = Depends(get_workout_service),
) -> WorkoutResponse | None:
    """The member's in-progress workout, or null."""
    view = await workouts.get_active(member)
    return to_workout_response(view) if view else None


@router.get("/week", response_model=WeekResponse, responses=error_responses(401, 403))
async def get_week(
    member: Member = Depends(get_current_member),
    context: ScoringContextBuilder = Depends(get_scoring_context),
    settings: Settings = Depends(get_settings),
) -> WeekResponse:
    """Workouts finished this crew-local week against the weekly target."""
    week = await context.week(member, utc_now())
    return WeekResponse(
        workouts=week.workouts_before,
        target=settings.game_weekly_target,
        leg_event_active=week.leg_event_active,
    )


@router.put(
    "/{workout_id}", response_model=WorkoutResponse, responses=error_responses(401, 403, 404, 409)
)
async def save_workout(
    workout_id: uuid.UUID,
    body: SaveWorkoutRequest,
    member: Member = Depends(get_current_member),
    workouts: WorkoutService = Depends(get_workout_service),
) -> WorkoutResponse:
    """Save the logger state. Returns the live points preview."""
    entries = tuple(
        ExerciseEntry(e.exercise_id, tuple(LoggedSet(**s.model_dump()) for s in e.sets))
        for e in body.exercises
    )
    return to_workout_response(await workouts.save(member, workout_id, body.name, entries))


@router.delete(
    "/{workout_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(401, 403, 404, 409),
)
async def discard_workout(
    workout_id: uuid.UUID,
    member: Member = Depends(get_current_member),
    workouts: WorkoutService = Depends(get_workout_service),
) -> None:
    """Throw away an in-progress workout."""
    await workouts.discard(member, workout_id)


@router.post(
    "/{workout_id}/finish",
    response_model=FinishResponse,
    responses=error_responses(401, 403, 404, 409),
)
async def finish_workout(
    workout_id: uuid.UUID,
    member: Member = Depends(get_current_member),
    finisher: WorkoutFinisher = Depends(get_workout_finisher),
    settings: Settings = Depends(get_settings),
) -> FinishResponse:
    """Score the workout, store its point events and PRs, and return the breakdown."""
    finished = await finisher.finish(member, workout_id)
    return to_finish_response(finished, settings.game_weekly_target)
