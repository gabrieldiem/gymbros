"""Crew membership."""

from fastapi import APIRouter, Depends

from db.tables.user import User
from dependencies import get_crew_service, get_current_user, get_profile_service
from models.errors import error_responses
from models.mappers import to_me_response
from models.me import InviteResponse, JoinCrewRequest, MeResponse
from services.crew_service import CrewService
from services.profile_service import ProfileService

router = APIRouter(prefix="/crews", tags=["Crews"])


@router.get("/invite/{code}", response_model=InviteResponse, responses=error_responses(404))
async def get_invite(code: str, crews: CrewService = Depends(get_crew_service)) -> InviteResponse:
    """Who an invite link is from. Public: it's shown before signing in, and needs the code."""
    crew, members = await crews.invite(code)
    return InviteResponse(crew_name=crew.name, members=members)


@router.post("/join", response_model=MeResponse, responses=error_responses(401, 404, 409))
async def join_crew(
    body: JoinCrewRequest,
    user: User = Depends(get_current_user),
    crews: CrewService = Depends(get_crew_service),
    profiles: ProfileService = Depends(get_profile_service),
) -> MeResponse:
    """Join the crew that owns the invite code. One crew per user."""
    await crews.join_by_code(user, body.invite_code)
    return to_me_response(await profiles.get(user))
