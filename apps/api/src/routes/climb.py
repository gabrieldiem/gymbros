"""ATUS Climb: the trail-map leaderboard."""

from typing import Literal

from fastapi import APIRouter, Depends, Query

from clock import utc_now
from dependencies import get_climb_service, get_current_member
from models.climb import ClimbResponse
from models.climb_mappers import to_climb_response
from models.errors import error_responses
from services.climb_service import ClimbService
from services.member import Member

router = APIRouter(prefix="/climb", tags=["ATUS Climb"])


@router.get("", response_model=ClimbResponse, responses=error_responses(401, 403))
async def get_climb(
    mode: Literal["all", "week"] = Query("all"),
    member: Member = Depends(get_current_member),
    climb: ClimbService = Depends(get_climb_service),
) -> ClimbResponse:
    """Rope order with camps, pips, streaks, gaps, next camp and you vs 4 weeks ago."""
    return to_climb_response(await climb.view(member, mode, utc_now()))
