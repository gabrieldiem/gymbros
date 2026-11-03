"""Timed sports, sets with no weight and custom exercises: what each pays, for the balance."""

from services.catalog import load_catalog
from services.training_rules import LoggedSet, effort_km, endurance_score


async def finish(client, exercises):
    workout = (await client.post("/api/workouts", json={"name": "Today"})).json()
    saved = await client.put(f"/api/workouts/{workout['id']}", json={"exercises": exercises})
    assert saved.status_code == 200, saved.text
    done = await client.post(f"/api/workouts/{workout['id']}/finish")
    assert done.status_code == 200, done.text
    return done.json()


def lines(finished):
    return {item["key"]: item["points"] for item in finished["line_items"]}


def custom(name="Sled push", reps=10):
    return {
        "exercise_id": "custom",
        "custom_name": name,
        "sets": [{"load_kg": 50, "reps": reps, "done": True}],
    }


async def test_an_hour_of_muay_thai_pays_about_what_an_hour_of_running_pays(client, member):
    thai = lines(
        await finish(client, [{"exercise_id": "muaythai", "sets": [{"minutes": 60, "done": True}]}])
    )
    assert thai["ln_show"] == 50
    assert thai["ln_cardio"] == 120
    assert thai["ln_intensity"] == 62
    assert "ln_distance" not in thai
    session = thai["ln_show"] + thai["ln_cardio"] + thai["ln_intensity"]
    assert 200 <= session <= 280  # A 10 km run in an hour pays 250.


async def test_muay_thai_three_times_a_week_reaches_the_weekly_goal(client, member):
    session = [{"exercise_id": "muaythai", "sets": [{"minutes": 60, "done": True}]}]
    await finish(client, session)
    await finish(client, session)
    assert "ln_goal" in lines(await finish(client, session))


def test_a_timed_sport_ignores_distance_and_has_no_record():
    thai = load_catalog().exercise("muaythai")
    assert effort_km(thai, LoggedSet(minutes=60, km=50)) == effort_km(thai, LoggedSet(minutes=60))
    assert endurance_score(thai, LoggedSet(minutes=600, done=True)) is None


async def test_sets_with_no_weight_pay_as_sets_with_no_volume_or_pr(client, member):
    air = {"exercise_id": "squat", "sets": [{"load_kg": 0, "reps": 20, "done": True}] * 3}
    first = await finish(client, [air])
    assert lines(first)["ln_sets"] == 15
    assert "ln_vol" not in lines(first)
    again = await finish(client, [air])
    assert "ln_pr" not in lines(again)
    stats = (await client.get("/api/me/stats")).json()
    assert [pr for pr in stats["prs"] if pr["exercise_id"] == "squat"] == []


async def test_a_real_weight_after_no_weight_sets_its_baseline(client, member):
    air = {"exercise_id": "squat", "sets": [{"load_kg": 0, "reps": 20, "done": True}]}
    await finish(client, [air])
    real = {"exercise_id": "squat", "sets": [{"load_kg": 60, "reps": 5, "done": True}]}
    assert "ln_pr" not in lines(await finish(client, [real]))
    stats = (await client.get("/api/me/stats")).json()
    assert [pr["load_kg"] for pr in stats["prs"] if pr["exercise_id"] == "squat"] == [60]


async def test_a_custom_exercise_pays_nothing_beside_a_real_one(client, member):
    bench = {"exercise_id": "bench", "sets": [{"load_kg": 60, "reps": 5, "done": True}]}
    alone = await finish(client, [bench])
    both = await finish(client, [bench, custom(reps=500)])
    paid = lines(both)
    assert paid["ln_custom"] == 0
    assert paid["ln_sets"] == lines(alone)["ln_sets"]
    assert paid["ln_vol"] == lines(alone)["ln_vol"]


async def test_only_custom_exercises_can_be_finished_but_pay_and_unlock_nothing(client, member):
    finished = await finish(client, [custom()])
    assert finished["total"] == 0
    assert list(lines(finished)) == ["ln_custom"]
    week = (await client.get("/api/workouts/week")).json()
    assert week["workouts"] == 0
    assert (await client.get("/api/climb?mode=all")).json()["standings"][0]["points"] == 0


async def test_the_name_is_kept_everywhere(client, member):
    finished = await finish(client, [custom("Sled push")])
    detail = (await client.get(f"/api/me/workouts/{finished['workout_id']}")).json()
    assert detail["exercises"][0]["custom_name"] == "Sled push"
    feed = (await client.get("/api/feed")).json()
    assert feed["items"][0]["vars"]["exercises"][0]["custom_name"] == "Sled push"
    export = (await client.get("/api/me/export")).json()
    assert export["workouts"][0]["exercises"][0]["name"] == "Sled push"


async def test_a_custom_exercise_needs_a_name(client, member):
    workout = (await client.post("/api/workouts", json={"name": "Today"})).json()
    nameless = {"exercise_id": "custom", "sets": []}
    response = await client.put(f"/api/workouts/{workout['id']}", json={"exercises": [nameless]})
    assert response.status_code == 422


async def test_only_a_custom_exercise_keeps_a_name(client, member):
    workout = (await client.post("/api/workouts", json={"name": "Today"})).json()
    renamed = {"exercise_id": "bench", "custom_name": "Mine", "sets": [{"reps": 5}]}
    saved = await client.put(f"/api/workouts/{workout['id']}", json={"exercises": [renamed]})
    assert saved.json()["exercises"][0]["custom_name"] is None


async def test_a_custom_exercise_doesnt_offer_another_ones_sets(client, member):
    await finish(client, [custom("Sled push")])
    workout = (await client.post("/api/workouts", json={"name": "Next"})).json()
    saved = await client.put(
        f"/api/workouts/{workout['id']}",
        json={
            "exercises": [
                {"exercise_id": "custom", "custom_name": "Tyre flip", "sets": [{"reps": 5}]}
            ]
        },
    )
    assert saved.json()["exercises"][0]["previous_sets"] == []


async def test_editing_to_only_custom_exercises_pays_nothing(client, member):
    bench = {"exercise_id": "bench", "sets": [{"load_kg": 60, "reps": 5, "done": True}]}
    finished = await finish(client, [bench])
    edited = await client.put(
        f"/api/workouts/{finished['workout_id']}/edit", json={"exercises": [custom()]}
    )
    assert edited.status_code == 200, edited.text
    keys = [item["key"] for item in edited.json()["line_items"]]
    assert "ln_show" not in keys
    assert "ln_custom" in keys
