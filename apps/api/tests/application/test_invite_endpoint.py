"""Invite links: what they show before signing in."""


async def test_an_invite_shows_the_crew_without_signing_in(client, crew, member):
    response = await client.get("/api/crews/invite/ironridge")
    assert response.status_code == 200
    assert response.json() == {"crew_name": "Iron Ridge", "members": 1}


async def test_an_unknown_invite_is_a_404(client, crew):
    response = await client.get("/api/crews/invite/NOPE1234")
    assert response.status_code == 404
    assert response.json() == {"detail": {"code": "invite_code_not_found"}}


async def test_an_invite_reveals_nothing_personal(client, crew, member):
    text = (await client.get("/api/crews/invite/IRONRIDGE")).text
    assert member["email"] not in text
    assert member["display_name"] not in text
