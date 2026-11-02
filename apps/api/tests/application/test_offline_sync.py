"""A workout logged with no signal arrives whole: once, dated when it happened."""

import uuid
from datetime import datetime, timedelta

from clock import utc_now
from services.training_rules import week_start

ZONE = "America/Argentina/Buenos_Aires"
BENCH = {"exercise_id": "bench", "sets": [{"load_kg": 60, "bar_kg": 20, "reps": 5, "done": True}]}


def body(**overrides):
    finished = utc_now() - timedelta(hours=2)
    return {
        "routine_id": "push",
        "name": "Push day",
        "gym": "Smart Fit",
        "performed_on": None,
        "started_at": (finished - timedelta(minutes=45)).isoformat(),
        "finished_at": finished.isoformat(),
        "exercises": [BENCH],
        **overrides,
    }


async def sync(client, workout_id=None, **overrides):
    return await client.post(
        f"/api/workouts/{workout_id or uuid.uuid4()}/sync", json=body(**overrides)
    )


async def test_it_needs_a_session(client):
    assert (await sync(client)).status_code == 401


async def test_a_workout_arrives_finished_and_scored(client, member):
    workout_id = uuid.uuid4()
    response = await sync(client, workout_id)
    assert response.status_code == 200
    result = response.json()
    assert result["workout_id"] == str(workout_id)
    assert "ln_show" in [item["key"] for item in result["line_items"]]
    assert result["total"] > 0
    assert (await client.get("/api/workouts/active")).json() is None
    assert (await client.get("/api/workouts/week")).json()["workouts"] == 1


async def test_it_keeps_the_times_it_happened_at(client, member):
    sent = body()
    response = await client.post(f"/api/workouts/{uuid.uuid4()}/sync", json=sent)
    result = response.json()
    assert datetime.fromisoformat(result["finished_at"]) == datetime.fromisoformat(
        sent["finished_at"]
    )
    assert datetime.fromisoformat(result["started_at"]) == datetime.fromisoformat(
        sent["started_at"]
    )


async def test_the_gym_and_sets_are_kept(client, member):
    workout_id = uuid.uuid4()
    await sync(client, workout_id)
    detail = (await client.get(f"/api/me/workouts/{workout_id}")).json()
    assert detail["gym"] == "Smart Fit"
    assert detail["exercises"][0]["sets"][0]["bar_kg"] == 20


async def test_sending_it_twice_counts_it_once(client, member):
    workout_id = uuid.uuid4()
    first = await sync(client, workout_id)
    second = await sync(client, workout_id)
    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "workout_finished"
    assert (await client.get("/api/workouts/week")).json()["workouts"] == 1
    climb = (await client.get("/api/climb")).json()
    assert climb["me"]["points"] == first.json()["total"]


async def test_it_finishes_a_workout_started_online(client, member):
    started = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    response = await sync(client, started["id"])
    assert response.status_code == 200
    assert (await client.get("/api/workouts/active")).json() is None
    assert (await client.get("/api/workouts/week")).json()["workouts"] == 1


async def test_it_can_arrive_while_another_workout_is_in_progress(client, member):
    active = (await client.post("/api/workouts", json={"routine_id": "pull"})).json()
    assert (await sync(client)).status_code == 200
    assert (await client.get("/api/workouts/active")).json()["id"] == active["id"]


async def test_someone_elses_id_is_not_found(client, other_client, crew, member):
    from tests.application.conftest import register_on

    await register_on(other_client, "maxo@example.com", crew.invite_code)
    started = (await other_client.post("/api/workouts", json={"routine_id": "push"})).json()
    response = await sync(client, started["id"])
    assert response.status_code == 404


async def test_nothing_completed_is_refused_and_leaves_nothing_behind(client, member):
    workout_id = uuid.uuid4()
    empty = {"exercise_id": "bench", "sets": [{"load_kg": 60, "reps": 5, "done": False}]}
    response = await sync(client, workout_id, exercises=[empty])
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "workout_empty"


async def test_an_unknown_exercise_is_refused(client, member):
    response = await sync(client, exercises=[{"exercise_id": "nope", "sets": []}])
    assert response.status_code == 422


async def test_a_time_in_the_future_counts_as_now(client, member):
    later = utc_now() + timedelta(days=2)
    result = (await sync(client, finished_at=later.isoformat())).json()
    assert datetime.fromisoformat(result["finished_at"]) <= utc_now() + timedelta(seconds=5)


async def test_a_time_older_than_a_week_counts_as_now(client, member):
    old = utc_now() - timedelta(days=30)
    result = (await sync(client, started_at=old.isoformat(), finished_at=old.isoformat())).json()
    finished = datetime.fromisoformat(result["finished_at"])
    assert finished >= utc_now() - timedelta(minutes=1)
    assert datetime.fromisoformat(result["started_at"]) <= finished


async def test_a_start_after_the_finish_is_moved_back(client, member):
    finished = utc_now() - timedelta(hours=1)
    result = (
        await sync(
            client,
            started_at=(finished + timedelta(hours=3)).isoformat(),
            finished_at=finished.isoformat(),
        )
    ).json()
    assert datetime.fromisoformat(result["started_at"]) == datetime.fromisoformat(
        result["finished_at"]
    )


async def test_it_counts_in_the_week_it_happened(client, member):
    finished = utc_now() - timedelta(days=7) + timedelta(minutes=1)
    await sync(client, finished_at=finished.isoformat(), started_at=finished.isoformat())
    assert (await client.get("/api/workouts/week")).json()["workouts"] == 0
    stats = (await client.get("/api/me/stats")).json()
    last_week = week_start(finished, ZONE)
    assert last_week.isoformat() in [w["week_start"] for w in stats["weekly_volume"]]


async def test_a_past_day_logged_offline_still_counts_on_that_day(client, member):
    today = utc_now().date()
    yesterday = (today - timedelta(days=2)).isoformat()
    result = await sync(client, performed_on=yesterday)
    assert result.status_code == 200
    assert result.json()["performed_on"] == yesterday


async def test_the_crew_isnt_told_youre_coming(client, other_client, crew, member):
    from tests.application.conftest import register_on

    await register_on(other_client, "maxo@example.com", crew.invite_code)
    await sync(client)
    assert (await other_client.get("/api/crew/training-now")).json() == []


# --- What a phone needs to start a workout with no signal ------------------------------------


async def test_the_templates_have_every_routine_ready_to_start(client, member):
    templates = (await client.get("/api/workouts/templates")).json()
    assert [t["routine_id"] for t in templates] == [
        "push",
        "pull",
        "legs",
        "cardio",
        "run",
        "swim",
        "stretch",
    ]
    push = templates[0]
    assert push["name"] == "Push day"
    assert [e["exercise_id"] for e in push["exercises"]] == ["bench", "ohp", "incline", "dips"]
    assert all(len(e["sets"]) == 3 for e in push["exercises"])


async def test_the_templates_are_loaded_to_beat_last_time(client, member):
    await sync(client)
    push = (await client.get("/api/workouts/templates")).json()[0]
    bench = push["exercises"][0]
    assert bench["sets"][0]["load_kg"] == 62.5
    assert bench["previous_sets"][0]["load_kg"] == 60
