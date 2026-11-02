"""The details of one of your own finished workouts, on the You tab."""

import uuid

from tests.application.conftest import register_on


async def finish_one(client):
    workout = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    exercises = [
        {
            "exercise_id": "bench",
            "sets": [
                {"load_kg": 60, "bar_kg": 20, "reps": 5, "done": True},
                {"load_kg": 80, "bar_kg": 20, "reps": 5, "done": False},
            ],
        },
        {"exercise_id": "ohp", "sets": [{"load_kg": None, "reps": None, "done": False}]},
    ]
    await client.put(f"/api/workouts/{workout['id']}", json={"exercises": exercises})
    finished = await client.post(f"/api/workouts/{workout['id']}/finish")
    assert finished.status_code == 200
    return finished.json()


async def test_the_details_list_what_you_did_and_what_it_paid(client, member):
    finished = await finish_one(client)
    body = (await client.get(f"/api/me/workouts/{finished['workout_id']}")).json()
    assert body["name"] == "Push day"
    assert body["points"] == finished["total"]
    assert body["sets"] == 1
    assert body["volume_kg"] == 300
    assert body["finished_at"] == finished["finished_at"]
    # Only what was completed: not the unchecked set, nor the exercise you skipped.
    assert [e["exercise_id"] for e in body["exercises"]] == ["bench"]
    assert len(body["exercises"][0]["sets"]) == 1
    assert body["exercises"][0]["sets"][0]["load_kg"] == 60
    assert body["exercises"][0]["sets"][0]["bar_kg"] == 20
    keys = [item["key"] for item in body["line_items"]]
    assert keys[:2] == ["ln_show", "ln_sets"]
    assert sum(item["points"] for item in body["line_items"]) == finished["total"]


async def test_someone_elses_workout_is_not_found(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    finished = await finish_one(other_client)
    response = await client.get(f"/api/me/workouts/{finished['workout_id']}")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "workout_not_found"


async def test_a_workout_in_progress_has_no_details_yet(client, member):
    workout = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    assert (await client.get(f"/api/me/workouts/{workout['id']}")).status_code == 404


async def test_an_unknown_workout_is_not_found(client, member):
    assert (await client.get(f"/api/me/workouts/{uuid.uuid4()}")).status_code == 404


async def test_the_details_need_a_session(client):
    assert (await client.get(f"/api/me/workouts/{uuid.uuid4()}")).status_code == 401
