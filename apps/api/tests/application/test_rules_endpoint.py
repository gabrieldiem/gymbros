"""The public list of what the game pays."""

from services.badges import load_badges
from services.quests import load_quests


async def test_rules_need_no_sign_in_and_match_the_settings(client):
    response = await client.get("/api/rules")
    assert response.status_code == 200
    body = response.json()
    assert body["points"]["showed_up"] == 50
    assert body["points"]["pr"] == 100
    assert body["crew_quest"] == 200
    assert body["bounty"] == 150
    assert body["duel_win"] == 150
    assert body["rank_step"] == 1500
    assert body["swim_km_factor"] == 4


async def test_rules_list_every_quest_and_badge(client):
    body = (await client.get("/api/rules")).json()
    assert [q["id"] for q in body["quests"]] == [q.id for q in load_quests()]
    assert [b["id"] for b in body["badges"]] == [b.id for b in load_badges()]
    assert {b["points"] for b in body["badges"]} == {b.points for b in load_badges()}


async def test_an_hour_of_each_sport_pays_about_the_same(client):
    sessions = {s["id"]: s for s in (await client.get("/api/rules")).json()["sessions"]}
    assert set(sessions) == {"lift", "run", "swim"}
    totals = [s["total"] for s in sessions.values()]
    assert max(totals) - min(totals) <= 10
    assert sessions["run"]["km"] == 10
    assert sessions["swim"]["km"] == 2.5
    assert sessions["lift"]["tonnes"] == 12


async def test_sample_totals_are_the_sum_of_their_lines(client):
    for session in (await client.get("/api/rules")).json()["sessions"]:
        assert session["total"] == sum(item["points"] for item in session["line_items"])


async def test_rules_expose_no_personal_data(client, member):
    text = (await client.get("/api/rules")).text
    assert member["email"] not in text
