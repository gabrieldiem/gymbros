"""Fixtures for HTTP-level tests."""

import pytest
from httpx import ASGITransport, AsyncClient

from main import app

from db.repositories.crew_repository import CrewRepository
from services.crew_service import CrewService


@pytest.fixture
async def crew(db_session):
    """A crew with invite code IRONRIDGE."""
    service = CrewService(CrewRepository(db_session))
    return await service.create("Iron Ridge", "America/Argentina/Buenos_Aires", "IRONRIDGE")


@pytest.fixture
def register(client):
    """Sign up through the dev login, with sensible defaults."""

    async def _register(**overrides):
        body = {"email": "gabi@example.com", "display_name": "Gabi"}
        body.update(overrides)
        return await client.post("/api/auth/dev-login", json=body)

    return _register


@pytest.fixture
async def member(register, crew):
    """Gabi, signed in on `client`, in the Iron Ridge crew."""
    response = await register(invite_code="IRONRIDGE")
    assert response.status_code == 200
    return response.json()


@pytest.fixture
async def other_client(client):
    """A second browser (own cookie jar) against the same app and test transaction."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as second:
        yield second


async def register_on(http_client, email: str, invite_code: str | None = None):
    """Register another user on a given client."""
    body = {"email": email, "display_name": email.split("@")[0].title()}
    if invite_code:
        body["invite_code"] = invite_code
    response = await http_client.post("/api/auth/dev-login", json=body)
    assert response.status_code == 200
    return response.json()
