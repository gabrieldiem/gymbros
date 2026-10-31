"""Fixtures for HTTP-level tests."""

import pytest

from db.repositories.crew_repository import CrewRepository
from services.crew_service import CrewService

PASSWORD = "climbing-pw"


@pytest.fixture
async def crew(db_session):
    """A crew with invite code IRONRIDGE."""
    service = CrewService(CrewRepository(db_session))
    return await service.create("Iron Ridge", "America/Argentina/Buenos_Aires", "IRONRIDGE")


@pytest.fixture
def register(client):
    """POST /api/auth/register with sensible defaults."""

    async def _register(**overrides):
        body = {"email": "gabi@example.com", "password": PASSWORD, "display_name": "Gabi"}
        body.update(overrides)
        return await client.post("/api/auth/register", json=body)

    return _register
