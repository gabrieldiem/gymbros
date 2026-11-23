"""The achievements for stretching, steps, timed sports and holds, earned through the real flows."""

from datetime import timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from clock import utc_now
from db.tables.point_event import PointEvent

ZONE = "America/Argentina/Buenos_Aires"


def done(**fields):
    return {**fields, "done": True}


async def finish(client, exercises):
    workout = (await client.post("/api/workouts", json={"routine_id": None, "name": "x"})).json()
    saved = await client.put(f"/api/workouts/{workout['id']}", json={"exercises": exercises})
    assert saved.status_code == 200, saved.text
    finished = await client.post(f"/api/workouts/{workout['id']}/finish")
    assert finished.status_code == 200, finished.text
    return finished.json()


def badges_in(finish_body):
    return [i["vars"]["badge"] for i in finish_body["line_items"] if i["key"] == "ln_badge"]


async def badge(client, badge_id):
    return next(b for b in (await client.get("/api/badges")).json() if b["id"] == badge_id)


async def test_limber_unlocks_on_the_tenth_session_with_stretching(client, member):
    session = [
        {"exercise_id": "curl", "sets": [done(load_kg=20, reps=10)]},
        {"exercise_id": "stretch", "sets": [done(minutes=5)]},
    ]
    for _ in range(9):
        assert "limber" not in badges_in(await finish(client, session))
    assert (await badge(client, "limber"))["progress"] == 9
    assert "limber" in badges_in(await finish(client, session))


async def test_engine_unlocks_after_five_hours_of_timed_sports(client, member):
    first = await finish(client, [{"exercise_id": "muaythai", "sets": [done(minutes=180)]}])
    assert "engine" not in badges_in(first)
    assert (await badge(client, "engine"))["progress"] == 3
    second = await finish(client, [{"exercise_id": "boxing", "sets": [done(minutes=120)]}])
    assert "engine" in badges_in(second)


async def test_iron_hold_unlocks_after_twenty_minutes_held(client, member):
    holds = [
        {"exercise_id": "lsit", "sets": [done(load_kg=0, reps=600)]},
        {"exercise_id": "frontlever", "sets": [done(load_kg=0, reps=599)]},
    ]
    assert "ironhold" not in badges_in(await finish(client, holds))
    one_more = [{"exercise_id": "crow", "sets": [done(load_kg=0, reps=1)]}]
    assert "ironhold" in badges_in(await finish(client, one_more))


async def test_quarter_million_unlocks_when_steps_are_logged(client, member, db_session):
    today = utc_now().astimezone(ZoneInfo(ZONE)).date()
    body = {
        "start_date": (today - timedelta(days=6)).isoformat(),
        "end_date": today.isoformat(),
        "steps": 250_000,
    }
    assert (await client.post("/api/steps", json=body)).status_code == 201
    assert (await badge(client, "quarter"))["unlocked_at"] is not None
    paid = await db_session.scalars(select(PointEvent.vars).where(PointEvent.key == "ln_badge"))
    assert {"badge": "quarter"} in list(paid)
