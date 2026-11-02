"""Stretching on its own: fixed points, once a day, never towards the weekly goal."""

from datetime import timedelta
from zoneinfo import ZoneInfo

from clock import utc_now
from tests.application.conftest import register_on

ZONE = ZoneInfo("America/Argentina/Buenos_Aires")
STRETCH = [{"exercise_id": "stretch", "sets": [{"minutes": 10, "done": True}]}]
BENCH = {"exercise_id": "bench", "sets": [{"load_kg": 60, "reps": 5, "done": True}]}


async def log(client, exercises, routine_id="stretch", performed_on=None):
    body = {"routine_id": routine_id, "name": "Stretching"}
    if performed_on:
        body["performed_on"] = performed_on
    workout = (await client.post("/api/workouts", json=body)).json()
    await client.put(f"/api/workouts/{workout['id']}", json={"exercises": exercises})
    return await client.post(f"/api/workouts/{workout['id']}/finish")


async def test_the_routine_starts_with_five_minutes_ready_to_check(client, member):
    body = (await client.post("/api/workouts", json={"routine_id": "stretch"})).json()
    assert [e["exercise_id"] for e in body["exercises"]] == ["stretch"]
    first = body["exercises"][0]["sets"]
    assert len(first) == 1
    assert first[0]["minutes"] == 5
    assert first[0]["done"] is False


async def test_the_catalog_says_its_default_minutes(client, member):
    catalog = (await client.get("/api/catalog")).json()
    stretch = next(e for e in catalog["exercises"] if e["id"] == "stretch")
    assert stretch["type"] == "s"
    assert stretch["default_minutes"] == 5
    assert catalog["points"]["stretching"] == 25


async def test_alone_it_pays_only_the_fixed_points(client, member):
    body = (await log(client, STRETCH)).json()
    assert [item["key"] for item in body["line_items"] if item["key"] != "ln_badge"] == [
        "ln_stretch"
    ]


async def test_alone_it_doesnt_count_towards_the_week(client, member):
    body = (await log(client, STRETCH)).json()
    assert body["workouts_this_week"] == 0
    assert (await client.get("/api/workouts/week")).json()["workouts"] == 0
    stats = (await client.get("/api/me/stats")).json()
    assert stats["workouts_total"] == 0


async def test_alone_it_doesnt_earn_the_first_workout_badge(client, member):
    body = (await log(client, STRETCH)).json()
    assert {"badge": "first"} not in [i["vars"] for i in body["line_items"]]
    assert "ln_badge" not in [i["key"] for i in body["line_items"]]


async def test_its_points_still_count_on_the_climb(client, member):
    await log(client, STRETCH)
    climb = (await client.get("/api/climb?mode=week")).json()
    assert climb["me"]["points"] == 25


async def test_it_shows_in_your_history_and_details(client, member):
    finished = (await log(client, STRETCH)).json()
    stats = (await client.get("/api/me/stats")).json()
    assert stats["history"][0]["id"] == finished["workout_id"]
    detail = (await client.get(f"/api/me/workouts/{finished['workout_id']}")).json()
    assert detail["exercises"][0]["sets"][0]["minutes"] == 10


async def test_it_pays_once_a_day_and_a_second_session_cant_finish(client, member):
    assert (await log(client, STRETCH)).status_code == 200
    again = await log(client, STRETCH)
    assert again.status_code == 409
    assert again.json()["detail"]["code"] == "stretching_already_logged"


async def test_with_a_workout_after_stretching_today_only_the_workout_pays(client, member):
    await log(client, STRETCH)
    body = (await log(client, [*STRETCH, BENCH], "push")).json()
    keys = [item["key"] for item in body["line_items"]]
    assert "ln_show" in keys
    assert "ln_stretch" not in keys
    assert body["workouts_this_week"] == 1


async def test_a_past_day_has_its_own_stretching(client, member):
    await log(client, STRETCH)
    yesterday = (utc_now().astimezone(ZONE).date() - timedelta(days=1)).isoformat()
    assert (await log(client, STRETCH, performed_on=yesterday)).status_code == 200


async def test_with_a_workout_it_adds_the_points_and_the_workout_counts(client, member):
    body = (await log(client, [*STRETCH, BENCH], "push")).json()
    keys = [item["key"] for item in body["line_items"]]
    assert "ln_stretch" in keys
    assert "ln_show" in keys
    assert body["workouts_this_week"] == 1
    assert body["completed_sets"] == 1


async def test_starting_it_doesnt_tell_the_crew_youre_coming(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    await log(other_client, [BENCH], "push")
    await client.post("/api/workouts", json={"routine_id": "stretch"})
    keys = [i["key"] for i in (await other_client.get("/api/notifications")).json()["items"]]
    assert "n_behind" not in keys
