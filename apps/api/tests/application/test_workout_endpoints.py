"""The Train flow over HTTP: start, log, live points, finish, overload, PRs, week, discard."""

from sqlalchemy import func, select

from db.tables.personal_record import PersonalRecord
from db.tables.point_event import PointEvent
from tests.application.conftest import register_on


def done(load_kg, reps):
    return {"load_kg": load_kg, "reps": reps, "done": True}


async def start(client, routine_id=None, name=None):
    body = {"routine_id": routine_id}
    if name:
        body["name"] = name
    return await client.post("/api/workouts", json=body)


async def save(client, workout_id, exercises, name=None):
    body = {"exercises": exercises}
    if name:
        body["name"] = name
    return await client.put(f"/api/workouts/{workout_id}", json=body)


async def log_and_finish(client, routine_id, exercises):
    workout = (await start(client, routine_id)).json()
    assert (await save(client, workout["id"], exercises)).status_code == 200
    return await client.post(f"/api/workouts/{workout['id']}/finish")


# --- Catalog -------------------------------------------------------------------------------


async def test_catalog_lists_exercises_routines_and_points(client, member):
    response = await client.get("/api/catalog")
    assert response.status_code == 200
    body = response.json()
    assert len(body["exercises"]) == 18
    assert [r["id"] for r in body["routines"]] == ["push", "pull", "legs", "cardio"]
    assert body["points"]["showed_up"] == 50
    assert body["weekly_event"] == "leg_day_x2"


async def test_catalog_requires_a_session(client):
    assert (await client.get("/api/catalog")).status_code == 401


# --- Start ---------------------------------------------------------------------------------


async def test_start_from_a_routine_lays_out_its_exercises(client, member):
    response = await start(client, "push")
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Push day"
    assert [e["exercise_id"] for e in body["exercises"]] == ["bench", "ohp", "incline", "dips"]
    assert all(len(e["sets"]) == 3 for e in body["exercises"])
    assert body["exercises"][0]["previous_sets"] == []
    assert body["live_points"] == 0


async def test_start_an_empty_workout(client, member):
    body = (await start(client, None, "Arms and abs")).json()
    assert body["name"] == "Arms and abs"
    assert body["exercises"] == []


async def test_only_one_workout_at_a_time(client, member):
    await start(client, "push")
    response = await start(client, "pull")
    assert response.status_code == 409
    assert response.json() == {"detail": {"code": "workout_already_active"}}


async def test_start_rejects_unknown_routines(client, member):
    response = await start(client, "chest-day")
    assert response.status_code == 422
    assert response.json() == {"detail": {"code": "unknown_routine"}}


async def test_start_requires_a_crew(client, register):
    await register()
    response = await start(client, "push")
    assert response.status_code == 403
    assert response.json() == {"detail": {"code": "not_in_crew"}}


async def test_start_requires_a_session(client):
    assert (await start(client, "push")).status_code == 401


# --- Log and live points --------------------------------------------------------------------


async def test_saving_sets_returns_live_points(client, member):
    workout = (await start(client)).json()
    response = await save(client, workout["id"], [{"exercise_id": "bench", "sets": [done(60, 5)]}])
    assert response.status_code == 200
    # showed up 50 + 1 set 5 + 300 kg → 3
    assert response.json()["live_points"] == 58
    active = (await client.get("/api/workouts/active")).json()
    assert active["exercises"][0]["sets"][0] == {
        "load_kg": 60.0,
        "reps": 5,
        "minutes": None,
        "km": None,
        "done": True,
    }


async def test_live_points_include_the_leg_day_event(client, member):
    workout = (await start(client)).json()
    response = await save(client, workout["id"], [{"exercise_id": "squat", "sets": [done(60, 5)]}])
    assert response.json()["live_points"] == 50 + 5 + 5 + 3


async def test_save_rejects_unknown_exercises_and_bad_numbers(client, member):
    workout = (await start(client)).json()
    unknown = await save(client, workout["id"], [{"exercise_id": "nope", "sets": [done(1, 1)]}])
    assert unknown.status_code == 422
    assert unknown.json() == {"detail": {"code": "unknown_exercise"}}
    negative = await save(client, workout["id"], [{"exercise_id": "bench", "sets": [done(60, -1)]}])
    assert negative.status_code == 422


async def test_cannot_touch_another_members_workout(client, member, other_client):
    workout = (await start(client, "push")).json()
    await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    response = await save(other_client, workout["id"], [])
    assert response.status_code == 404
    assert (await other_client.post(f"/api/workouts/{workout['id']}/finish")).status_code == 404
    assert (await other_client.delete(f"/api/workouts/{workout['id']}")).status_code == 404


# --- Finish --------------------------------------------------------------------------------


async def test_finish_scores_stores_point_events_and_closes_the_workout(client, member, db_session):
    response = await log_and_finish(
        client, "push", [{"exercise_id": "bench", "sets": [done(60, 5), done(60, 5)]}]
    )
    assert response.status_code == 200
    body = response.json()
    assert [i["key"] for i in body["line_items"]] == ["ln_show", "ln_sets", "ln_vol"]
    assert body["total"] == 50 + 10 + 6
    assert body["volume_kg"] == 600
    assert body["workouts_this_week"] == 1
    assert body["weekly_target"] == 3
    assert body["prs"] == []  # first log is the baseline
    assert (await client.get("/api/workouts/active")).json() is None

    stored = await db_session.scalar(select(func.sum(PointEvent.points)))
    assert stored == body["total"]
    record = await db_session.get(PersonalRecord, (member["id"], "bench"))
    assert (record.load_kg, record.reps) == (60, 5)


async def test_finish_needs_a_completed_set(client, member):
    workout = (await start(client, "push")).json()
    response = await client.post(f"/api/workouts/{workout['id']}/finish")
    assert response.status_code == 409
    assert response.json() == {"detail": {"code": "workout_empty"}}


async def test_a_finished_workout_cannot_change(client, member):
    workout = (await start(client)).json()
    await save(client, workout["id"], [{"exercise_id": "curl", "sets": [done(30, 10)]}])
    await client.post(f"/api/workouts/{workout['id']}/finish")
    again = await client.post(f"/api/workouts/{workout['id']}/finish")
    assert again.status_code == 409
    assert again.json() == {"detail": {"code": "workout_finished"}}


async def test_next_session_is_prefilled_to_beat_last_time(client, member):
    await log_and_finish(
        client,
        "push",
        [
            {"exercise_id": "bench", "sets": [done(90, 5), done(90, 5)]},
            {"exercise_id": "incline", "sets": [done(30, 10)]},
            {"exercise_id": "dips", "sets": [done(10, 8)]},
        ],
    )
    body = (await start(client, "push")).json()
    by_id = {e["exercise_id"]: e for e in body["exercises"]}
    assert [(s["load_kg"], s["reps"]) for s in by_id["bench"]["sets"]] == [(92.5, 5), (92.5, 5)]
    assert [(s["load_kg"], s["reps"]) for s in by_id["incline"]["sets"]] == [(30, 11)]
    assert [(s["load_kg"], s["reps"]) for s in by_id["dips"]["sets"]] == [(10, 9)]
    assert not any(s["done"] for s in by_id["bench"]["sets"])
    assert [(s["load_kg"], s["reps"]) for s in by_id["bench"]["previous_sets"]] == [
        (90, 5),
        (90, 5),
    ]
    assert len(by_id["ohp"]["sets"]) == 3  # never logged: three empty sets


async def test_cardio_is_prefilled_with_one_more_minute(client, member):
    await log_and_finish(
        client,
        "cardio",
        [{"exercise_id": "run", "sets": [{"minutes": 25, "km": 4.2, "done": True}]}],
    )
    body = (await start(client, "cardio")).json()
    run = body["exercises"][0]
    assert (run["sets"][0]["minutes"], run["sets"][0]["km"]) == (26, 4.2)


async def test_beating_last_time_pays_pr_and_better_than_last_time(client, member):
    await log_and_finish(client, "legs", [{"exercise_id": "squat", "sets": [done(100, 5)]}])
    body = (
        await log_and_finish(client, "legs", [{"exercise_id": "squat", "sets": [done(102.5, 5)]}])
    ).json()
    keys = {i["key"]: i for i in body["line_items"]}
    assert keys["ln_pr"] == {
        "key": "ln_pr",
        "vars": {"exercise_id": "squat", "load_kg": 102.5, "reps": 5},
        "points": 100,
    }
    assert keys["ln_better"]["vars"] == {"pct": 2}
    assert body["vs_last_pct"] == 2
    assert body["prs"] == [{"exercise_id": "squat", "load_kg": 102.5, "reps": 5}]


async def test_third_workout_of_the_week_pays_the_weekly_goal_and_streak(client, member):
    for _ in range(2):
        await log_and_finish(client, None, [{"exercise_id": "curl", "sets": [done(30, 10)]}])
    body = (
        await log_and_finish(client, None, [{"exercise_id": "curl", "sets": [done(30, 10)]}])
    ).json()
    keys = {i["key"]: (i["vars"], i["points"]) for i in body["line_items"]}
    assert keys["ln_goal"] == ({"n": 3}, 150)
    assert keys["ln_streak"] == ({"weeks": 1}, 20)
    assert body["workouts_this_week"] == 3
    assert (await client.get("/api/workouts/week")).json() == {
        "workouts": 3,
        "target": 3,
        "leg_event_active": True,
    }


# --- Discard and training now --------------------------------------------------------------


async def test_discard_removes_the_workout(client, member):
    workout = (await start(client, "push")).json()
    assert (await client.delete(f"/api/workouts/{workout['id']}")).status_code == 204
    assert (await client.get("/api/workouts/active")).json() is None
    assert (await start(client, "push")).status_code == 201


async def test_training_now_lists_crew_members_mid_workout(client, member, other_client):
    await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    workout = (await start(other_client, "push")).json()
    await save(
        other_client,
        workout["id"],
        [
            {"exercise_id": "bench", "sets": [done(90, 5)]},
            {"exercise_id": "ohp", "sets": [{"load_kg": 50, "reps": 5, "done": False}]},
        ],
    )
    response = await client.get("/api/crew/training-now")
    assert response.status_code == 200
    [item] = response.json()
    assert item["display_name"] == "Maxo"
    assert item["workout_name"] == "Push day"
    assert item["current_exercise_id"] == "ohp"


async def test_training_now_is_scoped_to_the_crew(client, member, other_client, db_session):
    from db.repositories.crew_repository import CrewRepository
    from services.crew_service import CrewService

    await CrewService(CrewRepository(db_session)).create("Other", "UTC", "OTHERCREW")
    await register_on(other_client, "stranger@example.com", "OTHERCREW")
    await start(other_client, "push")
    assert (await client.get("/api/crew/training-now")).json() == []
