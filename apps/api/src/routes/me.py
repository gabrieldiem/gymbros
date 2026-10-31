"""The signed-in user's profile."""

from fastapi import APIRouter, Depends

from db.tables.user import User
from dependencies import (
    get_current_member,
    get_current_user,
    get_me_stats_service,
    get_profile_service,
)
from models.compete import LiftPoint, MeStatsResponse
from models.compete_mappers import to_me_stats
from models.errors import error_responses
from models.mappers import to_me_response
from models.me import MeResponse, UpdateMeRequest
from services.me_stats_service import MeStatsService
from services.member import Member
from services.profile_service import ProfileChanges, ProfileService

router = APIRouter(prefix="/me", tags=["Me"])


@router.get("", response_model=MeResponse, responses=error_responses(401))
async def get_me(
    user: User = Depends(get_current_user),
    profiles: ProfileService = Depends(get_profile_service),
) -> MeResponse:
    """The signed-in user with their crew."""
    return to_me_response(await profiles.get(user))


@router.patch("", response_model=MeResponse, responses=error_responses(401))
async def update_me(
    body: UpdateMeRequest,
    user: User = Depends(get_current_user),
    profiles: ProfileService = Depends(get_profile_service),
) -> MeResponse:
    """Change display name, initials, color or language."""
    changes = ProfileChanges(**body.model_dump(exclude_unset=True))
    return to_me_response(await profiles.update(user, changes))


@router.get("/stats", response_model=MeStatsResponse, responses=error_responses(401, 403))
async def get_my_stats(
    member: Member = Depends(get_current_member),
    stats: MeStatsService = Depends(get_me_stats_service),
) -> MeStatsResponse:
    """The You tab: totals, heatmap, weekly tonnage, PRs and recent workouts."""
    return to_me_stats(await stats.stats(member))


@router.get(
    "/prs/{exercise_id}", response_model=list[LiftPoint], responses=error_responses(401, 403, 404)
)
async def get_lift_history(
    exercise_id: str,
    member: Member = Depends(get_current_member),
    stats: MeStatsService = Depends(get_me_stats_service),
) -> list[LiftPoint]:
    """Best e1RM per week for a lift, for the PR progress chart."""
    return [
        LiftPoint(week_start=w, e1rm=e) for w, e in await stats.lift_history(member, exercise_id)
    ]
