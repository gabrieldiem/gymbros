"""Hard badges that read stats of their own: the heaviest deadlift and the longest L-sit."""


def done(load_kg, reps):
    return {"load_kg": load_kg, "reps": reps, "done": True}


async def finish(client, exercises):
    workout = (await client.post("/api/workouts", json={"routine_id": None, "name": "x"})).json()
    saved = await client.put(f"/api/workouts/{workout['id']}", json={"exercises": exercises})
    assert saved.status_code == 200, saved.text
    finished = await client.post(f"/api/workouts/{workout['id']}/finish")
    assert finished.status_code == 200, finished.text
    return [i["vars"]["badge"] for i in finished.json()["line_items"] if i["key"] == "ln_badge"]


async def test_two_hundred_club_needs_a_200_kg_deadlift(client, member):
    assert "deadlift200" not in await finish(
        client, [{"exercise_id": "deadlift", "sets": [done(197.5, 1)]}]
    )
    assert "deadlift200" in await finish(
        client, [{"exercise_id": "deadlift", "sets": [done(200, 1)]}]
    )


async def test_a_sixty_second_l_sit_must_be_one_set(client, member):
    # Two 30 s sets are a minute held, not a minute-long L-sit.
    assert "lsitminute" not in await finish(
        client, [{"exercise_id": "lsit", "sets": [done(0, 30), done(0, 30)]}]
    )
    assert "lsitminute" in await finish(client, [{"exercise_id": "lsit", "sets": [done(0, 60)]}])


async def test_hard_badges_say_they_are_hard(client, member):
    badges = {b["id"]: b for b in (await client.get("/api/badges")).json()}
    assert badges["lifer"]["elite"] is True
    assert badges["first"]["elite"] is False
    rules = {b["id"]: b for b in (await client.get("/api/rules")).json()["badges"]}
    assert rules["legend"]["elite"] is True
