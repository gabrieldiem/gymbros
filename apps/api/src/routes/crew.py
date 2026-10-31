"""The member's crew."""

from fastapi import APIRouter, Depends

from dependencies import get_current_member, get_training_now_service
from models.errors import error_responses
from models.workout_mappers import to_training_now_item
from models.workouts import TrainingNowItem
from services.member import Member
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
