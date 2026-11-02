"""Your profile: any two characters or a picture, and any color."""

import uuid

from httpx import ASGITransport, AsyncClient

from main import app
from tests.application.conftest import register_on

PNG = b"\x89PNG\r\n\x1a\n" + b"pixels" * 10
JPEG = b"\xff\xd8\xff\xe0" + b"pixels" * 10
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"pixels" * 10


async def upload(client, data=PNG, content_type="image/png"):
    return await client.put("/api/me/avatar", content=data, headers={"Content-Type": content_type})


async def test_emoji_can_be_your_picture(client, member):
    body = (await client.patch("/api/me", json={"initials": "🔥💪"})).json()
    assert body["initials"] == "🔥💪"
    me = (await client.get("/api/me")).json()
    assert me["initials"] == "🔥💪"


async def test_more_than_two_characters_are_refused(client, member):
    response = await client.patch("/api/me", json={"initials": "abc"})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_avatar_text"


async def test_a_new_name_keeps_the_characters_you_chose(client, member):
    await client.patch("/api/me", json={"initials": "🔥"})
    body = (await client.patch("/api/me", json={"display_name": "Gabriel Diem"})).json()
    assert body["initials"] == "🔥"


async def test_a_new_name_changes_characters_you_never_chose(client, member):
    body = (await client.patch("/api/me", json={"display_name": "Gabriel Diem"})).json()
    assert body["initials"] == "GD"


async def test_any_color_works_alongside_the_palette(client, member):
    assert (await client.patch("/api/me", json={"color": "#FF8A1F"})).json()["color"] == "#ff8a1f"
    assert (await client.patch("/api/me", json={"color": "cyan"})).json()["color"] == "cyan"
    climb = (await client.patch("/api/me", json={"color": "#123456"})).json()
    assert climb["color"] == "#123456"
    assert (await client.get("/api/climb")).status_code == 200


async def test_a_picture_goes_up_and_comes_back(client, member):
    assert (await client.get("/api/me")).json()["avatar_url"] is None
    body = (await upload(client)).json()
    assert body["avatar_url"].startswith(f"/api/avatars/{body['id']}?v=")
    picture = await client.get(body["avatar_url"])
    assert picture.status_code == 200
    assert picture.content == PNG
    assert picture.headers["content-type"] == "image/png"
    assert picture.headers["x-content-type-options"] == "nosniff"
    assert "immutable" in picture.headers["cache-control"]


async def test_each_upload_gets_a_new_url(client, member):
    first = (await upload(client)).json()["avatar_url"]
    second = (await upload(client, JPEG)).json()["avatar_url"]
    assert first != second
    assert (await client.get(second)).content == JPEG


async def test_the_type_comes_from_the_bytes_not_the_client(client, member):
    body = (await upload(client, JPEG, "image/png")).json()
    picture = await client.get(body["avatar_url"])
    assert picture.headers["content-type"] == "image/jpeg"
    webp = (await upload(client, WEBP, "application/octet-stream")).json()
    assert (await client.get(webp["avatar_url"])).headers["content-type"] == "image/webp"


async def test_what_isnt_a_picture_is_refused(client, member):
    for data in (b"<svg onload=alert(1)>", b"<html>", b"GIF89a", b""):
        response = await upload(client, data)
        assert response.status_code == 415, data
        assert response.json()["detail"]["code"] == "image_not_supported"


async def test_too_big_is_refused(client, member):
    response = await upload(client, PNG + b"x" * (301 * 1024))
    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "image_too_large"


async def test_removing_it_goes_back_to_your_characters(client, member):
    url = (await upload(client)).json()["avatar_url"]
    body = (await client.delete("/api/me/avatar")).json()
    assert body["avatar_url"] is None
    assert (await client.get(url)).status_code == 404


async def test_your_crew_sees_it_with_your_name(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    url = (await upload(client)).json()["avatar_url"]
    assert (await other_client.get(url)).content == PNG
    climb = (await other_client.get("/api/climb")).json()
    assert url in [s["avatar_url"] for s in climb["standings"]]


async def test_someone_outside_your_crew_cant_see_it(client, other_client, crew, member):
    url = (await upload(client)).json()["avatar_url"]
    await register_on(other_client, "stranger@example.com")
    assert (await other_client.get(url)).status_code == 404


async def test_it_needs_a_session(client):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anonymous:
        assert (await anonymous.get(f"/api/avatars/{uuid.uuid4()}")).status_code == 401
        assert (await anonymous.delete("/api/me/avatar")).status_code == 401
