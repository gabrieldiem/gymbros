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


# --- Signing in from the docs -------------------------------------------------------------------


def session_token(client) -> str:
    token = client.cookies.get("gymbros_session")
    assert token
    return token


async def test_the_session_cookie_also_works_as_a_bearer_token(client, other_client, member):
    """Swagger's Authorize (and curl) can't send a cookie, so the same token goes in a header."""
    headers = {"Authorization": f"Bearer {session_token(client)}"}
    response = await other_client.get("/api/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == member["id"]


async def test_a_wrong_bearer_token_is_refused(other_client, member):
    response = await other_client.get("/api/me", headers={"Authorization": "Bearer nope"})
    assert response.status_code == 401
    assert response.json() == {"detail": {"code": "not_authenticated"}}


async def test_a_bearer_token_gets_no_more_than_its_session(client, other_client, member):
    """A member's token opens what the member can open, and the admin routes still say no."""
    headers = {"Authorization": f"Bearer {session_token(client)}"}
    assert (await other_client.get("/api/admin/overview", headers=headers)).status_code == 403


async def test_the_spec_marks_what_needs_a_session(client):
    spec = (await client.get("/api/openapi.json")).json()
    schemes = spec["components"]["securitySchemes"]
    assert schemes["session cookie"] == {
        "type": "apiKey",
        "in": "cookie",
        "name": "gymbros_session",
        "description": schemes["session cookie"]["description"],
    }
    assert schemes["session token"]["scheme"] == "bearer"
    assert spec["paths"]["/api/me"]["get"]["security"] == [
        {"session cookie": []},
        {"session token": []},
    ]
    assert "security" not in spec["paths"]["/api/rules"]["get"]
    assert "Authorize" in spec["info"]["description"]
