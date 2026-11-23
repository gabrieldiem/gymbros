"""Repeating a recent workout: pick one from the list and start it again, pre-filled to beat it."""

from datetime import timedelta
from zoneinfo import ZoneInfo

from clock import utc_now
from tests.application.conftest import register_on

ZONE = "America/Argentina/Buenos_Aires"


def done(load_kg, reps):
    return {"load_kg": load_kg, "reps": reps, "done": True}


async def finish(client, exercises, routine_id=None, name=None):
    body = {"routine_id": routine_id}
    if name:
        body["name"] = name
    workout = (await client.post("/api/workouts", json=body)).json()
    saved = await client.put(f"/api/workouts/{workout['id']}", json={"exercises": exercises})
    assert saved.status_code == 200, saved.text
    finished = await client.post(f"/api/workouts/{workout['id']}/finish")
    assert finished.status_code == 200, finished.text
    return workout["id"]


PUSH = [
    {"exercise_id": "bench", "sets": [done(60, 5), done(60, 5)]},
    {"exercise_id": "dips", "sets": [done(0, 10)]},
]
CALISTHENICS = [
    {"exercise_id": "lsit", "sets": [done(0, 20)]},
    {"exercise_id": "custom", "custom_name": "Muscle-up", "sets": [done(0, 3)]},
]


async def test_recent_lists_your_latest_workouts_once_each(client, member):
    await finish(client, PUSH, "push")
    await finish(client, CALISTHENICS, name="Park")
    newest_push = await finish(client, PUSH, "push")
    recent = (await client.get("/api/workouts/recent")).json()
    assert [r["id"] for r in recent][:1] == [newest_push]
    assert [r["name"] for r in recent] == ["Push day", "Park"]
    assert recent[0]["exercise_ids"] == ["bench", "dips"]
    assert recent[1]["custom_names"] == ["Muscle-up"]


async def test_recent_is_empty_before_your_first_workout(client, member):
    assert (await client.get("/api/workouts/recent")).json() == []


async def test_repeating_starts_the_same_exercises_loaded_to_beat_it(client, member):
    source = await finish(client, PUSH, "push")
    response = await client.post("/api/workouts", json={"repeat_workout_id": source})
    assert response.status_code == 201, response.text
    workout = response.json()
    assert (workout["name"], workout["routine_id"]) == ("Push day", "push")
    bench, dips = workout["exercises"]
    assert bench["exercise_id"] == "bench"
    # A barbell lift adds 2.5 kg, the rest a rep; they're suggestions until logged.
    assert [(s["load_kg"], s["reps"], s["done"]) for s in bench["sets"]] == [(62.5, 5, False)] * 2
    assert [(s["load_kg"], s["reps"]) for s in dips["sets"]] == [(0, 11)]


async def test_repeating_keeps_custom_exercises_and_holds(client, member):
    source = await finish(client, CALISTHENICS, name="Park")
    workout = (await client.post("/api/workouts", json={"repeat_workout_id": source})).json()
    lsit, custom = workout["exercises"]
    assert lsit["exercise_id"] == "lsit" and lsit["sets"][0]["reps"] == 21
    assert custom["custom_name"] == "Muscle-up"
    assert workout["name"] == "Park"


async def test_repeating_for_a_past_day_loads_it_as_it_was(client, member):
    source = await finish(client, PUSH, "push")
    yesterday = utc_now().astimezone(ZoneInfo(ZONE)).date() - timedelta(days=1)
    body = {"repeat_workout_id": source, "performed_on": yesterday.isoformat()}
    workout = (await client.post("/api/workouts", json=body)).json()
    assert workout["performed_on"] == yesterday.isoformat()
    assert [(s["load_kg"], s["reps"]) for s in workout["exercises"][0]["sets"]] == [(60, 5)] * 2


async def test_sets_you_skipped_arent_repeated(client, member):
    skipped = [{"exercise_id": "curl", "sets": [{"load_kg": 20, "reps": 10, "done": False}]}]
    source = await finish(client, PUSH + skipped, "push")
    workout = (await client.post("/api/workouts", json={"repeat_workout_id": source})).json()
    assert [e["exercise_id"] for e in workout["exercises"]] == ["bench", "dips"]


async def test_you_can_only_repeat_your_own_finished_workouts(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    theirs = await finish(other_client, PUSH, "push")
    response = await client.post("/api/workouts", json={"repeat_workout_id": theirs})
    assert response.status_code == 404
    open_one = (await client.post("/api/workouts", json={"routine_id": "pull"})).json()
    await client.delete(f"/api/workouts/{open_one['id']}")
    response = await client.post("/api/workouts", json={"repeat_workout_id": open_one["id"]})
    assert response.status_code == 404
