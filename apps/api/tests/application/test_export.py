"""Your training, all of it, as a JSON file you can keep."""

import json

from tests.application.conftest import register_on

BENCH = {
    "exercise_id": "bench",
    "sets": [
        {"load_kg": 60, "bar_kg": 20, "reps": 5, "done": True},
        {"load_kg": 80, "bar_kg": 20, "reps": 5, "done": False},
    ],
}
RUN = {"exercise_id": "outrun", "sets": [{"minutes": 30, "km": 5, "done": True}]}


async def log(client, exercises, routine_id="push"):
    workout = (await client.post("/api/workouts", json={"routine_id": routine_id})).json()
    await client.put(f"/api/workouts/{workout['id']}", json={"exercises": exercises})
    return (await client.post(f"/api/workouts/{workout['id']}/finish")).json()


async def test_it_needs_a_session(client):
    assert (await client.get("/api/me/export")).status_code == 401


async def test_it_downloads_as_a_json_file(client, member):
    response = await client.get("/api/me/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    disposition = response.headers["content-disposition"]
    assert disposition.startswith('attachment; filename="gymbros-export-')
    assert disposition.endswith('.json"')
    body = json.loads(response.content)
    assert body["format"] == "gymbros-export"
    assert body["version"] == 1


async def test_it_has_who_you_are(client, member):
    body = (await client.get("/api/me/export")).json()
    assert body["account"]["email"] == "gabi@example.com"
    assert body["account"]["display_name"] == "Gabi"
    assert body["account"]["crew"] == "Iron Ridge"


async def test_it_has_every_session_with_its_sets_and_points(client, member):
    await client.post("/api/me/gyms", json={"name": "Smart Fit"})
    first = await log(client, [BENCH])
    await log(client, [RUN], "run")
    body = (await client.get("/api/me/export")).json()
    assert [w["name"] for w in body["workouts"]] == ["Push day", "Run"]
    workout = body["workouts"][0]
    assert workout["id"] == first["workout_id"]
    assert workout["gym"] == "Smart Fit"
    assert workout["points"] == first["total"]
    assert workout["finished_at"] == first["finished_at"]
    assert workout["volume_kg"] == 300
    exercise = workout["exercises"][0]
    assert (exercise["exercise_id"], exercise["name"]) == ("bench", "Bench press")
    # Everything as it was logged, whether it was checked off or not.
    assert [(s["load_kg"], s["bar_kg"], s["reps"], s["done"]) for s in exercise["sets"]] == [
        (60, 20, 5, True),
        (80, 20, 5, False),
    ]
    assert sum(line["points"] for line in workout["point_lines"]) == first["total"]
    assert workout["point_lines"][0]["key"] == "ln_show"


async def test_it_has_your_records_and_gyms(client, member):
    await client.post("/api/me/gyms", json={"name": "Smart Fit"})
    await log(client, [BENCH])
    body = (await client.get("/api/me/export")).json()
    assert body["personal_records"][0]["exercise_id"] == "bench"
    assert body["personal_records"][0]["load_kg"] == 60
    assert [(g["name"], g["is_default"]) for g in body["gyms"]] == [("Smart Fit", True)]


async def test_a_workout_in_progress_isnt_in_it(client, member):
    await client.post("/api/workouts", json={"routine_id": "push"})
    assert (await client.get("/api/me/export")).json()["workouts"] == []


async def test_it_has_only_your_own_training(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    await log(other_client, [RUN], "run")
    await log(client, [BENCH])
    body = (await client.get("/api/me/export")).json()
    assert [w["name"] for w in body["workouts"]] == ["Push day"]
    assert "maxo@example.com" not in json.dumps(body)


async def test_it_works_without_a_crew(other_client, crew):
    await register_on(other_client, "lonely@example.com")
    body = (await other_client.get("/api/me/export")).json()
    assert body["account"]["crew"] is None
    assert body["workouts"] == []
