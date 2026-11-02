"""Your gyms: several, one default, and which one each workout was at."""

from tests.application.conftest import register_on


async def add(client, name):
    return await client.post("/api/me/gyms", json={"name": name})


async def names(client):
    return [(g["name"], g["is_default"]) for g in (await client.get("/api/me/gyms")).json()]


async def test_you_start_with_no_gyms(client, member):
    assert (await client.get("/api/me/gyms")).json() == []


async def test_the_gyms_need_a_session(client):
    assert (await client.get("/api/me/gyms")).status_code == 401


async def test_the_first_gym_is_the_default(client, member):
    assert (await add(client, "Smart Fit")).json()["is_default"] is True
    assert (await add(client, "Home")).json()["is_default"] is False
    assert await names(client) == [("Smart Fit", True), ("Home", False)]


async def test_a_name_is_trimmed_and_cant_repeat_or_be_blank(client, member):
    assert (await add(client, "  Smart Fit  ")).json()["name"] == "Smart Fit"
    repeated = await add(client, "smart fit")
    assert repeated.status_code == 409
    assert repeated.json()["detail"]["code"] == "gym_name_taken"
    assert (await add(client, "   ")).status_code == 422
    assert (await add(client, "x" * 41)).status_code == 422


async def test_there_is_a_limit(client, member):
    for i in range(10):
        assert (await add(client, f"Gym {i}")).status_code == 201
    over = await add(client, "One more")
    assert over.status_code == 409
    assert over.json()["detail"]["code"] == "too_many_gyms"


async def test_another_gym_can_become_the_default(client, member):
    await add(client, "Smart Fit")
    home = (await add(client, "Home")).json()
    response = await client.patch(f"/api/me/gyms/{home['id']}", json={"is_default": True})
    assert response.status_code == 200
    assert await names(client) == [("Smart Fit", False), ("Home", True)]


async def test_a_gym_can_be_renamed(client, member):
    gym = (await add(client, "Smart Fit")).json()
    await client.patch(f"/api/me/gyms/{gym['id']}", json={"name": "Smart Fit Palermo"})
    assert await names(client) == [("Smart Fit Palermo", True)]


async def test_deleting_the_default_makes_the_oldest_left_the_default(client, member):
    first = (await add(client, "Smart Fit")).json()
    await add(client, "Home")
    await add(client, "Club")
    assert (await client.delete(f"/api/me/gyms/{first['id']}")).status_code == 204
    assert await names(client) == [("Home", True), ("Club", False)]


async def test_you_cant_touch_someone_elses_gym(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    gym = (await add(other_client, "Theirs")).json()
    url = f"/api/me/gyms/{gym['id']}"
    assert (await client.delete(url)).status_code == 404
    assert (await client.patch(url, json={"name": "Mine"})).status_code == 404


async def test_a_workout_starts_at_your_default_gym(client, member):
    await add(client, "Smart Fit")
    body = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    assert body["gym"] == "Smart Fit"


async def test_without_gyms_a_workout_has_none(client, member):
    body = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    assert body["gym"] is None


async def test_you_can_pick_another_gym_or_none_when_starting(client, member):
    await add(client, "Smart Fit")
    picked = await client.post("/api/workouts", json={"routine_id": "push", "gym": "Home"})
    assert picked.json()["gym"] == "Home"
    await client.delete(f"/api/workouts/{picked.json()['id']}")
    none = await client.post("/api/workouts", json={"routine_id": "push", "gym": None})
    assert none.json()["gym"] is None


async def test_you_can_change_the_gym_while_logging(client, member):
    await add(client, "Smart Fit")
    workout = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    url = f"/api/workouts/{workout['id']}"
    assert (await client.put(url, json={"exercises": [], "gym": "Home"})).json()["gym"] == "Home"
    # Saving without saying anything about the gym leaves it alone.
    assert (await client.put(url, json={"exercises": []})).json()["gym"] == "Home"
    assert (await client.put(url, json={"exercises": [], "gym": None})).json()["gym"] is None


async def test_friends_see_the_gym_in_training_now_and_the_feed(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    await add(client, "Smart Fit")
    workout = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    live = (await other_client.get("/api/crew/training-now")).json()
    assert live[0]["gym"] == "Smart Fit"
    bench = {"exercise_id": "bench", "sets": [{"load_kg": 60, "reps": 5, "done": True}]}
    await client.put(f"/api/workouts/{workout['id']}", json={"exercises": [bench]})
    await client.post(f"/api/workouts/{workout['id']}/finish")
    feed = (await other_client.get("/api/feed")).json()["items"]
    post = next(i for i in feed if i["kind"] == "workout")
    assert post["vars"]["gym"] == "Smart Fit"


async def test_a_finished_workout_keeps_the_name_it_was_logged_with(client, member):
    gym = (await add(client, "Smart Fit")).json()
    workout = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    bench = {"exercise_id": "bench", "sets": [{"load_kg": 60, "reps": 5, "done": True}]}
    await client.put(f"/api/workouts/{workout['id']}", json={"exercises": [bench]})
    await client.post(f"/api/workouts/{workout['id']}/finish")
    await client.delete(f"/api/me/gyms/{gym['id']}")
    detail = (await client.get(f"/api/me/workouts/{workout['id']}")).json()
    assert detail["gym"] == "Smart Fit"
