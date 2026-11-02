"""What the game pays. Public: the landing page lists it before anyone signs in."""

from fastapi import APIRouter, Depends

from dependencies import get_scoring_rules, get_settings
from models.rules import RuleBadgeModel, RuleQuestModel, RulesResponse, SampleSessionModel
from models.workouts import LineItemModel
from services.catalog import load_catalog
from services.public_rules import build_public_rules
from services.scoring_types import ScoringRules
from settings import Settings

router = APIRouter(prefix="/rules", tags=["Rules"])


@router.get("", response_model=RulesResponse)
async def get_rules(
    rules: ScoringRules = Depends(get_scoring_rules),
    settings: Settings = Depends(get_settings),
) -> RulesResponse:
    """Points per task, quests, achievements and three sample sessions. No sign-in needed."""
    public = build_public_rules(
        load_catalog(), rules, settings.game_rank_step, settings.game_rank_count
    )
    return RulesResponse(
        points=public.points,
        crew_quest=settings.scoring_crew_quest,
        crew_quest_goal=settings.scoring_crew_quest_goal,
        bounty=settings.scoring_bounty,
        duel_win=settings.scoring_duel_win,
        rank_step=public.rank_step,
        rank_count=public.rank_count,
        swim_km_factor=public.swim_km_factor,
        quests=[RuleQuestModel(id=q.id, goal=q.goal, bonus=q.bonus) for q in public.quests],
        badges=[
            RuleBadgeModel(id=b.id, goal=b.goal, points=b.points, icon=b.icon, color=b.color)
            for b in public.badges
        ],
        sessions=[
            SampleSessionModel(
                id=s.id,
                minutes=s.minutes,
                km=s.km,
                tonnes=s.tonnes,
                total=s.score.total,
                line_items=[
                    LineItemModel(key=i.key, vars=dict(i.vars), points=i.points)
                    for i in s.score.line_items
                ],
            )
            for s in public.sessions
        ],
    )
