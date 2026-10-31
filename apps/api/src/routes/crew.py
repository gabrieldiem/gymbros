"""The member's crew."""

from fastapi import APIRouter, Depends, status

from dependencies import (
    get_current_member,
    get_hall_of_fame_service,
    get_nudge_service,
    get_training_now_service,
)
from models.errors import error_responses
from models.social import ActorModel, HallOfFameResponse, NudgeRequest
from models.social_mappers import to_actor, to_hall_of_fame_response
from models.workout_mappers import to_training_now_item
from models.workouts import TrainingNowItem
from services.hall_of_fame_service import HallOfFameService
from services.member import Member
from services.nudge_service import NudgeService
from services.training_now_service import TrainingNowService

router = APIRouter(prefix="/crew", tags=["Crew"])


@router.get(
    "/training-now", response_model=list[TrainingNowItem], responses=error_responses(401, 403)
)
async def get_training_now(
    member: Member = Depends(get_current_member),
    service: TrainingNowService = Depends(get_training_now_service),
) -> list[TrainingNowItem]:
    """Crew members with a workout in progress, and what they're on."""
    return [to_training_now_item(active) for active in await service.list(member)]


@router.post(
    "/nudges",
    status_code=status.HTTP_201_CREATED,
    response_model=ActorModel,
    responses=error_responses(401, 403, 404, 409, 422),
)
async def nudge(
    body: NudgeRequest,
    member: Member = Depends(get_current_member),
    nudges: NudgeService = Depends(get_nudge_service),
) -> ActorModel:
    """Poke a crew mate who hasn't trained in a while. Once a day per member."""
    return to_actor(await nudges.nudge(member, body.user_id))


@router.get("/hall-of-fame", response_model=HallOfFameResponse, responses=error_responses(401, 403))
async def get_hall_of_fame(
    member: Member = Depends(get_current_member),
    hall: HallOfFameService = Depends(get_hall_of_fame_service),
) -> HallOfFameResponse:
    """Most improved this month (against themselves) and crew records."""
    return to_hall_of_fame_response(await hall.hall_of_fame(member))
