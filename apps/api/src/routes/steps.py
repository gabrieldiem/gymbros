"""Steps: logging them, taking them back and the crew climbing by them."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, status

from dependencies import get_current_member, get_steps_service
from models.errors import error_responses
from models.steps import LogStepsRequest, StepEntryModel, StepsResponse, to_steps_response
from services.member import Member
from services.steps_service import StepsService

router = APIRouter(prefix="/steps", tags=["Steps"])


@router.get("", response_model=StepsResponse, responses=error_responses(401, 403))
async def get_steps(
    mode: Literal["week", "all"] = Query("week"),
    member: Member = Depends(get_current_member),
    steps: StepsService = Depends(get_steps_service),
) -> StepsResponse:
    """The crew on the steps climb, your days, and what you've logged."""
    view = await steps.dashboard(member, mode)
    return to_steps_response(view, steps, member.user.id)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=StepEntryModel,
    responses=error_responses(401, 403, 409, 422),
)
async def log_steps(
    body: LogStepsRequest,
    member: Member = Depends(get_current_member),
    steps: StepsService = Depends(get_steps_service),
) -> StepEntryModel:
    """Log a total for a day or a period. The points are worked out here."""
    assert body.end_date is not None
    entry = await steps.log(member, body.start_date, body.end_date, body.steps)
    return StepEntryModel(
        id=entry.id,
        start_date=entry.start_date,
        end_date=entry.end_date,
        steps=entry.steps,
        points=entry.points,
    )


@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(401, 403, 404, 409),
)
async def remove_steps(
    entry_id: uuid.UUID,
    member: Member = Depends(get_current_member),
    steps: StepsService = Depends(get_steps_service),
) -> None:
    """Take back something you logged, soon after logging it."""
    await steps.remove(member, entry_id)
