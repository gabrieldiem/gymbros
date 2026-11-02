"""Your gyms."""

import uuid

from fastapi import APIRouter, Depends, status

from db.tables.user import User
from dependencies import get_current_user, get_gym_service
from models.errors import error_responses
from models.gyms import (
    AddGymRequest,
    GymLocationModel,
    GymModel,
    UpdateGymRequest,
    to_gym_model,
)
from services.gym_service import GymLocation, GymService

router = APIRouter(prefix="/me/gyms", tags=["Me"])


def _location(model: GymLocationModel | None) -> GymLocation | None:
    return GymLocation(model.lat, model.lon, model.address) if model else None


@router.get("", response_model=list[GymModel], responses=error_responses(401))
async def list_gyms(
    user: User = Depends(get_current_user),
    gyms: GymService = Depends(get_gym_service),
) -> list[GymModel]:
    """Your gyms, oldest first."""
    return [to_gym_model(gym) for gym in await gyms.list(user.id)]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=GymModel,
    responses=error_responses(401, 409, 422),
)
async def add_gym(
    body: AddGymRequest,
    user: User = Depends(get_current_user),
    gyms: GymService = Depends(get_gym_service),
) -> GymModel:
    """Add a gym. The first one becomes the default."""
    return to_gym_model(await gyms.add(user.id, body.name, _location(body.location)))


@router.patch("/{gym_id}", response_model=GymModel, responses=error_responses(401, 404, 409, 422))
async def update_gym(
    gym_id: uuid.UUID,
    body: UpdateGymRequest,
    user: User = Depends(get_current_user),
    gyms: GymService = Depends(get_gym_service),
) -> GymModel:
    """Rename a gym or make it the default."""
    change_location = "location" in body.model_fields_set
    gym = await gyms.update(
        user.id, gym_id, body.name, body.is_default, change_location, _location(body.location)
    )
    return to_gym_model(gym)


@router.delete(
    "/{gym_id}", status_code=status.HTTP_204_NO_CONTENT, responses=error_responses(401, 404)
)
async def delete_gym(
    gym_id: uuid.UUID,
    user: User = Depends(get_current_user),
    gyms: GymService = Depends(get_gym_service),
) -> None:
    """Delete a gym. Workouts keep the name they were logged with."""
    await gyms.delete(user.id, gym_id)
