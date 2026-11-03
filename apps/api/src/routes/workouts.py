"""Start, log, finish and discard workouts. Points are only computed on the server."""

import uuid

from fastapi import APIRouter, Depends, Request, Response, status

from clock import utc_now
from dependencies import (
    get_me_stats_service,
    get_workout_editor,
    get_current_member,
    get_gym_service,
    get_scoring_context,
    get_settings,
    get_workout_finisher,
    get_workout_photo_service,
    get_workout_service,
)
from models.compete import WorkoutDetailResponse
from models.compete_mappers import to_workout_detail
from models.errors import error_responses
from models.photos import PhotoResponse, photo_url
from models.workout_mappers import to_finish_response, to_workout_response, to_workout_template
from models.workouts import (
    FinishResponse,
    PastDayModel,
    SaveWorkoutRequest,
    SyncWorkoutRequest,
    WorkoutTemplate,
    StartWorkoutRequest,
    WeekResponse,
    WorkoutResponse,
)
from routes.uploads import image_response, read_upload
from services.gym_service import GymService
from services.images import MAX_PHOTO_BYTES
from services.me_stats_service import MeStatsService
from services.member import Member
from services.scoring_context import ScoringContextBuilder
from services.training_rules import LoggedSet, week_end
from services.workout_editor import WorkoutChanges, WorkoutEditor
from services.workout_finisher import WorkoutFinisher
from services.workout_photo_service import WorkoutPhotoService
from services.workout_service import WorkoutService
from services.workout_types import ExerciseEntry, LoggedOffline
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
    gyms: GymService = Depends(get_gym_service),
) -> WorkoutResponse:
    """Start a workout from a routine (pre-filled to beat last time) or empty, or log a past day."""
    gym = body.gym if "gym" in body.model_fields_set else await gyms.default_name(member.user.id)
    view = await workouts.start(member, body.routine_id, body.name, body.performed_on, gym)
    return to_workout_response(view)


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
    workouts: WorkoutService = Depends(get_workout_service),
    settings: Settings = Depends(get_settings),
) -> WeekResponse:
    """Workouts finished this crew-local week against the weekly target."""
    now = utc_now()
    week = await context.week(member, now)
    return WeekResponse(
        workouts=week.workouts_before,
        target=settings.game_weekly_target,
        leg_event_active=week.leg_event_active,
        event_ends_at=week_end(now, member.crew.time_zone) if week.leg_event_active else None,
        past_days=[
            PastDayModel(day=p.day, workouts=p.workouts) for p in await workouts.past_days(member)
        ],
    )


@router.get("/templates", response_model=list[WorkoutTemplate], responses=error_responses(401, 403))
async def get_templates(
    member: Member = Depends(get_current_member),
    workouts: WorkoutService = Depends(get_workout_service),
) -> list[WorkoutTemplate]:
    """Every routine as it would start now, so a phone can start one with no signal."""
    return [to_workout_template(t) for t in await workouts.templates(member)]


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
        ExerciseEntry(
            e.exercise_id, tuple(LoggedSet(**s.model_dump()) for s in e.sets), e.custom_name
        )
        for e in body.exercises
    )
    change_gym = "gym" in body.model_fields_set
    return to_workout_response(
        await workouts.save(member, workout_id, body.name, entries, change_gym, body.gym)
    )


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


@router.put(
    "/{workout_id}/photo",
    response_model=PhotoResponse,
    responses=error_responses(401, 403, 404, 413, 415),
)
async def upload_photo(
    workout_id: uuid.UUID,
    request: Request,
    member: Member = Depends(get_current_member),
    photos: WorkoutPhotoService = Depends(get_workout_photo_service),
) -> PhotoResponse:
    """Add or replace the photo of your workout. The body is the image itself."""
    data = await read_upload(request, MAX_PHOTO_BYTES)
    workout = await photos.upload(member, workout_id, data)
    return PhotoResponse(photo_url=photo_url(workout.id, workout.photo_version))


@router.delete(
    "/{workout_id}/photo", response_model=PhotoResponse, responses=error_responses(401, 403, 404)
)
async def remove_photo(
    workout_id: uuid.UUID,
    member: Member = Depends(get_current_member),
    photos: WorkoutPhotoService = Depends(get_workout_photo_service),
) -> PhotoResponse:
    """Remove the photo of your workout."""
    workout = await photos.remove(member, workout_id)
    return PhotoResponse(photo_url=photo_url(workout.id, workout.photo_version))


@router.get("/{workout_id}/photo", responses=error_responses(401, 403, 404))
async def get_photo(
    workout_id: uuid.UUID,
    member: Member = Depends(get_current_member),
    photos: WorkoutPhotoService = Depends(get_workout_photo_service),
) -> Response:
    """A workout's photo, for its crew. Its URL changes with each upload, so it caches for good."""
    photo = await photos.view(member, workout_id)
    return image_response(photo.image, photo.content_type)


@router.post(
    "/{workout_id}/sync",
    response_model=FinishResponse,
    responses=error_responses(401, 403, 404, 409, 422),
)
async def sync_workout(
    workout_id: uuid.UUID,
    body: SyncWorkoutRequest,
    member: Member = Depends(get_current_member),
    finisher: WorkoutFinisher = Depends(get_workout_finisher),
    settings: Settings = Depends(get_settings),
) -> FinishResponse:
    """A whole workout logged with no signal. Sending it twice is safe: the second is a 409."""
    logged = LoggedOffline(
        workout_id=workout_id,
        routine_id=body.routine_id,
        name=body.name,
        gym=body.gym,
        performed_on=body.performed_on,
        started_at=body.started_at,
        finished_at=body.finished_at,
        entries=tuple(
            ExerciseEntry(
                e.exercise_id, tuple(LoggedSet(**s.model_dump()) for s in e.sets), e.custom_name
            )
            for e in body.exercises
        ),
    )
    return to_finish_response(await finisher.sync(member, logged), settings.game_weekly_target)


@router.put(
    "/{workout_id}/edit",
    response_model=WorkoutDetailResponse,
    responses=error_responses(401, 403, 404, 409),
)
async def edit_workout(
    workout_id: uuid.UUID,
    body: SaveWorkoutRequest,
    member: Member = Depends(get_current_member),
    editor: WorkoutEditor = Depends(get_workout_editor),
    stats: MeStatsService = Depends(get_me_stats_service),
) -> WorkoutDetailResponse:
    """Change a finished workout, within the time allowed, and rescore it."""
    entries = tuple(
        ExerciseEntry(
            e.exercise_id, tuple(LoggedSet(**s.model_dump()) for s in e.sets), e.custom_name
        )
        for e in body.exercises
    )
    change_gym = "gym" in body.model_fields_set
    changes = WorkoutChanges(body.name, entries, change_gym, body.gym)
    await editor.edit(member, workout_id, changes)
    return to_workout_detail(await stats.workout_detail(member, workout_id))


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
