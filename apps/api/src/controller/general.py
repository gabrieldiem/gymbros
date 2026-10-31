"""General controller endpoints: root and health."""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncEngine

from controller.responses import HEALTH_RESPONSES, ROOT_RESPONSES
from db.health import is_database_up
from dependencies import get_engine

router = APIRouter()


@router.get(
    "/",
    status_code=status.HTTP_200_OK,
    tags=["General"],
    summary="Root Endpoint",
    response_description="Return service status",
    responses=ROOT_RESPONSES,
)
async def root():
    """Check if the API service is up and running."""
    return {"status": "ok", "service": "gymbros-api"}


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    tags=["General"],
    summary="Health Check",
    response_description="Returns 200 if the service and database are healthy",
    responses=HEALTH_RESPONSES,
)
async def health_check(response: Response, engine: AsyncEngine = Depends(get_engine)):
    """Report service health, including database reachability."""
    if await is_database_up(engine):
        return {"status": "running", "database": "up"}
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "degraded", "database": "down"}
