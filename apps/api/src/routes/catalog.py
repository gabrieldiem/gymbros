"""The exercise catalog, routines and points table."""

from dataclasses import asdict

from fastapi import APIRouter, Depends

from db.tables.user import User
from dependencies import get_current_user, get_scoring_rules, get_settings
from models.catalog import CatalogResponse, ExerciseModel, RoutineModel
from models.errors import error_responses
from services.catalog import load_catalog
from services.scoring_types import ScoringRules
from settings import Settings

router = APIRouter(prefix="/catalog", tags=["Train"])


@router.get("", response_model=CatalogResponse, responses=error_responses(401))
async def get_catalog(
    _user: User = Depends(get_current_user),
    rules: ScoringRules = Depends(get_scoring_rules),
    settings: Settings = Depends(get_settings),
) -> CatalogResponse:
    """Exercises (English names, Spanish search aliases), routines and point values."""
    catalog = load_catalog()
    return CatalogResponse(
        exercises=[
            ExerciseModel(**{**asdict(e), "aliases_es": list(e.aliases_es)})
            for e in catalog.exercises
        ],
        routines=[
            RoutineModel(id=r.id, name=r.name, exercise_ids=list(r.exercise_ids))
            for r in catalog.routines
        ],
        points=rules,
        weekly_event=settings.game_weekly_event or None,
    )
