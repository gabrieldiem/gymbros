"""Joining a crew by invite code."""


async def test_join_crew_by_invite_code(client, register, crew):
    await register()
    response = await client.post("/api/crews/join", json={"invite_code": "iron-ridge"})
    assert response.status_code == 200
    assert response.json()["crew"] == {
        "id": str(crew.id),
        "name": "Iron Ridge",
        "time_zone": "America/Argentina/Buenos_Aires",
        "invite_code": "IRONRIDGE",
    }


async def test_members_get_different_colors(client, register, crew):
    first = await register(email="a@example.com", invite_code="IRONRIDGE")
    await client.post("/api/auth/logout")
    second = await register(email="b@example.com", invite_code="IRONRIDGE")
    assert first.json()["color"] == "volt"
    assert second.json()["color"] == "red"


async def test_join_with_unknown_code_is_not_found(client, register, crew):
    await register()
    response = await client.post("/api/crews/join", json={"invite_code": "ZZZZ9999"})
    assert response.status_code == 404
    assert response.json() == {"detail": {"code": "invite_code_not_found"}}


async def test_join_a_second_crew_conflicts(client, register, crew):
    await register(invite_code="IRONRIDGE")
    response = await client.post("/api/crews/join", json={"invite_code": "IRONRIDGE"})
    assert response.status_code == 409
    assert response.json() == {"detail": {"code": "already_in_crew"}}


async def test_join_requires_a_session(client, crew):
    response = await client.post("/api/crews/join", json={"invite_code": "IRONRIDGE"})
    assert response.status_code == 401


async def test_join_validates_input(client, register):
    await register()
    assert (await client.post("/api/crews/join", json={"invite_code": ""})).status_code == 422
