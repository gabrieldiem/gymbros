"""What's new: the list of features, newest first."""

from fastapi import APIRouter, Depends

from db.tables.user import User
from dependencies import get_current_user
from models.errors import error_responses
from models.whats_new import WhatsNewModel
from services.whats_new import load_whats_new

router = APIRouter(prefix="/whats-new", tags=["Me"])


@router.get("", response_model=list[WhatsNewModel], responses=error_responses(401))
async def get_whats_new(_user: User = Depends(get_current_user)) -> list[WhatsNewModel]:
    """Every feature members have been told about."""
    return [WhatsNewModel(id=e.id, date=e.date, link=e.link) for e in load_whats_new()]
