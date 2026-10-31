"""Quests, badges, duels and the weekly recap."""

import uuid

from fastapi import APIRouter, Depends, status

from dependencies import (
    get_badge_service,
    get_current_member,
    get_duel_service,
    get_quest_service,
    get_recap_service,
)
from models.compete import BadgeModel, DuelModel, DuelRequest, QuestBoardResponse, RecapResponse
from models.compete_mappers import to_badge, to_duel, to_quest_board, to_recap
from models.errors import error_responses
from services.badge_service import BadgeService
from services.duel_service import DuelService
from services.member import Member
from services.quest_service import QuestService
from services.recap_service import RecapService

router = APIRouter(tags=["Compete"])


@router.get("/quests", response_model=QuestBoardResponse, responses=error_responses(401, 403))
async def get_quests(
    member: Member = Depends(get_current_member),
    quests: QuestService = Depends(get_quest_service),
) -> QuestBoardResponse:
    """Weekly quests, the crew quest, the bounty and the weekly event."""
    return to_quest_board(await quests.board(member))


@router.get("/badges", response_model=list[BadgeModel], responses=error_responses(401, 403))
async def get_badges(
    member: Member = Depends(get_current_member),
    badges: BadgeService = Depends(get_badge_service),
) -> list[BadgeModel]:
    """All 15 badges with your progress."""
    return [to_badge(view) for view in await badges.views(member)]


@router.get("/duels", response_model=list[DuelModel], responses=error_responses(401, 403))
async def get_duels(
    member: Member = Depends(get_current_member),
    duels: DuelService = Depends(get_duel_service),
) -> list[DuelModel]:
    """Your duels this week (finished weeks are settled first)."""
    return [to_duel(view) for view in await duels.views(member)]


@router.post(
    "/duels",
    status_code=status.HTTP_201_CREATED,
    response_model=DuelModel,
    responses=error_responses(401, 403, 404, 409, 422),
)
async def challenge(
    body: DuelRequest,
    member: Member = Depends(get_current_member),
    duels: DuelService = Depends(get_duel_service),
) -> DuelModel:
    """Challenge a crew mate until Sunday night."""
    return to_duel(await duels.challenge(member, body.opponent_id, body.metric, body.stake))


@router.post(
    "/duels/{duel_id}/accept",
    response_model=DuelModel,
    responses=error_responses(401, 403, 404, 409),
)
async def accept_duel(
    duel_id: uuid.UUID,
    member: Member = Depends(get_current_member),
    duels: DuelService = Depends(get_duel_service),
) -> DuelModel:
    """Accept a duel you were challenged to."""
    return to_duel(await duels.respond(member, duel_id, accept=True))


@router.post(
    "/duels/{duel_id}/decline",
    response_model=DuelModel,
    responses=error_responses(401, 403, 404, 409),
)
async def decline_duel(
    duel_id: uuid.UUID,
    member: Member = Depends(get_current_member),
    duels: DuelService = Depends(get_duel_service),
) -> DuelModel:
    """Decline a duel you were challenged to."""
    return to_duel(await duels.respond(member, duel_id, accept=False))


@router.get("/recap", response_model=RecapResponse, responses=error_responses(401, 403))
async def get_recap(
    member: Member = Depends(get_current_member),
    recap: RecapService = Depends(get_recap_service),
) -> RecapResponse:
    """Last week's story: crew total, biggest climber, heaviest PR, your week, most improved."""
    return to_recap(await recap.recap(member))
