"""Finding places for a gym. No paid maps API: OpenStreetMap search, and links as they come."""

from fastapi import APIRouter, Depends, Query

from db.tables.user import User
from dependencies import get_current_user, get_place_service
from models.errors import error_responses
from models.places import FromLinkRequest, PlaceModel
from services.place_service import PlaceService
from services.places import Place

router = APIRouter(prefix="/places", tags=["Me"])


def _model(place: Place) -> PlaceModel:
    return PlaceModel(name=place.name, address=place.address, lat=place.lat, lon=place.lon)


@router.get("", response_model=list[PlaceModel], responses=error_responses(401, 422, 503))
async def search_places(
    q: str = Query(min_length=1, max_length=200),
    user: User = Depends(get_current_user),
    places: PlaceService = Depends(get_place_service),
) -> list[PlaceModel]:
    """Places matching what someone typed."""
    return [_model(place) for place in await places.search(q, user.language)]


@router.post("/from-link", response_model=PlaceModel, responses=error_responses(401, 422, 503))
async def place_from_link(
    body: FromLinkRequest,
    user: User = Depends(get_current_user),
    places: PlaceService = Depends(get_place_service),
) -> PlaceModel:
    """The place in a link copied from Google Maps or OpenStreetMap."""
    return _model(await places.from_link(body.url, user.language))
