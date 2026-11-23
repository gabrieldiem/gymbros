"""Swagger UI and the OpenAPI spec live under /api, so the nginx and Vite proxies reach them."""


async def test_the_openapi_spec_lists_the_api(client):
    response = await client.get("/api/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert spec["info"]["title"] == "gymbros-api"
    assert "/api/workouts" in spec["paths"]
    assert "/health" in spec["paths"]
    # Never documented: it only exists for demo and e2e accounts.
    assert "/api/auth/dev-login" not in spec["paths"]


async def test_swagger_ui_reads_the_spec_from_under_api(client):
    response = await client.get("/api/docs")
    assert response.status_code == 200
    assert "swagger-ui" in response.text
    assert "/api/openapi.json" in response.text
    assert (await client.get("/api/redoc")).status_code == 200


async def test_nothing_is_left_at_the_old_root_paths(client):
    assert (await client.get("/docs")).status_code == 404
    assert (await client.get("/openapi.json")).status_code == 404
