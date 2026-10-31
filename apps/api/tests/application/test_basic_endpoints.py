"""Root and health endpoints, at `/` and under the `/api` prefix the browser uses."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine

from dependencies import get_engine
from main import app


async def test_root_ok(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "gymbros-api"}


@pytest.mark.parametrize("path", ["/health", "/api/health"])
async def test_health_ok(client: AsyncClient, path: str):
    response = await client.get(path)
    assert response.status_code == 200
    assert response.json() == {"status": "running", "database": "up"}


async def test_health_reports_database_down(client: AsyncClient):
    unreachable = create_async_engine("postgresql+asyncpg://u:p@127.0.0.1:1/none")
    app.dependency_overrides[get_engine] = lambda: unreachable
    try:
        response = await client.get("/api/health")
    finally:
        del app.dependency_overrides[get_engine]
        await unreachable.dispose()
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "down"}
