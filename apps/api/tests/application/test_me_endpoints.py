"""GET and PATCH /api/me."""


async def test_me_requires_a_session(client):
    response = await client.get("/api/me")
    assert response.status_code == 401


async def test_patch_me_changes_language_color_and_name(client, register):
    await register()
    response = await client.patch(
        "/api/me", json={"language": "es", "color": "cyan", "display_name": "Gabriel Diem"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["language"] == "es"
    assert body["color"] == "cyan"
    assert body["display_name"] == "Gabriel Diem"
    assert body["initials"] == "GD"
    assert (await client.get("/api/me")).json()["language"] == "es"


async def test_patch_me_keeps_omitted_fields(client, register):
    await register(language="es")
    response = await client.patch("/api/me", json={"initials": "gx"})
    assert response.json()["initials"] == "GX"
    assert response.json()["language"] == "es"


async def test_patch_me_rejects_values_outside_the_palette_and_languages(client, register):
    await register()
    assert (await client.patch("/api/me", json={"color": "#123456"})).status_code == 422
    assert (await client.patch("/api/me", json={"language": "fr"})).status_code == 422
    assert (await client.patch("/api/me", json={"initials": "ABC"})).status_code == 422


async def test_patch_me_requires_a_session(client):
    assert (await client.patch("/api/me", json={"language": "es"})).status_code == 401
