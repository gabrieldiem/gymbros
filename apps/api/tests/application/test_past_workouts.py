"""Logging a workout you forgot to log, up to a week back: when it counts and who hears about it."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select

from clock import utc_now
from db.tables.notification import Notification
from db.tables.point_event import PointEvent
from services.badges import local_hours_and_gaps
from services.training_rules import local_noon, past_days, week_start
from tests.application.conftest import register_on

ZONE = "America/Argentina/Buenos_Aires"


def local_today():
    return utc_now().astimezone(ZoneInfo(ZONE)).date()


def days_ago(days):
    return local_today() - timedelta(days=days)


def done(load_kg, reps):
    return {"load_kg": load_kg, "reps": reps, "done": True}


BENCH = [{"exercise_id": "bench", "sets": [done(60, 5)]}]
LEGS = [{"exercise_id": "squat", "sets": [done(60, 5)]}]


async def log(client, days, exercises=None, routine_id=None):
    """Log and finish a past workout `days` ago. Returns the finish body."""
    started = await client.post(
        "/api/workouts",
        json={
            "routine_id": routine_id,
            "name": "Forgot this one",
            "performed_on": days_ago(days).isoformat(),
        },
    )
    assert started.status_code == 201, started.text
    workout_id = started.json()["id"]
    saved = await client.put(f"/api/workouts/{workout_id}", json={"exercises": exercises or BENCH})
    assert saved.status_code == 200, saved.text
    finished = await client.post(f"/api/workouts/{workout_id}/finish")
    assert finished.status_code == 200, finished.text
    return finished.json()


def test_the_days_follow_the_crews_clock():
    # 02:00 UTC on Tuesday the 3rd is still Monday the 2nd in Buenos Aires.
    days = past_days(datetime(2026, 11, 3, 2, 0, tzinfo=UTC), ZONE, 7)
    assert days[0] == date(2026, 11, 1)
    assert days[-1] == date(2026, 10, 26)


def test_noon_stays_clear_of_the_dawn_and_night_badges():
    assert local_hours_and_gaps([local_noon(date(2026, 11, 1), ZONE)], ZONE) == (0, 0, 0)


# --- Which days ---------------------------------------------------------------------------------


async def test_the_week_lists_the_seven_days_you_can_pick(client, member):
    await log(client, 2)
    days = (await client.get("/api/workouts/week")).json()["past_days"]
    assert [d["day"] for d in days] == [days_ago(n).isoformat() for n in range(1, 8)]
    assert [d["workouts"] for d in days] == [0, 1, 0, 0, 0, 0, 0]


async def test_seven_days_ago_is_allowed(client, member):
    body = {"routine_id": None, "name": "Old", "performed_on": days_ago(7).isoformat()}
    response = await client.post("/api/workouts", json=body)
    assert response.status_code == 201
    assert response.json()["performed_on"] == days_ago(7).isoformat()


async def test_other_days_are_refused(client, member):
    for days in (8, 0, -1):
        body = {"routine_id": None, "name": "Old", "performed_on": days_ago(days).isoformat()}
        response = await client.post("/api/workouts", json=body)
        assert response.status_code == 422, days
        assert response.json()["detail"]["code"] == "workout_date_out_of_range"


async def test_a_normal_workout_has_no_past_day(client, member):
    body = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    assert body["performed_on"] is None


async def test_you_cant_log_a_past_workout_during_another_one(client, member):
    await client.post("/api/workouts", json={"routine_id": "push"})
    body = {"routine_id": None, "name": "Old", "performed_on": days_ago(1).isoformat()}
    response = await client.post("/api/workouts", json=body)
    assert response.status_code == 409


# --- When it counts -----------------------------------------------------------------------------


async def test_it_counts_on_the_day_you_picked_at_noon(client, member):
    body = await log(client, 7)
    assert body["performed_on"] == days_ago(7).isoformat()
    assert datetime.fromisoformat(body["finished_at"]) == local_noon(days_ago(7), ZONE)
    assert body["started_at"] == body["finished_at"]


async def test_its_points_land_in_that_week(client, member, db_session):
    await log(client, 7)
    last_week = week_start(local_noon(days_ago(7), ZONE), ZONE)
    result = await db_session.execute(select(PointEvent.key, PointEvent.week_start))
    weeks = dict(result.all())
    assert weeks["ln_show"] == last_week
    # A badge is about where you stand now, so it's this week's.
    assert weeks["ln_badge"] == week_start(utc_now(), ZONE)
    assert (await client.get("/api/workouts/week")).json()["workouts"] == 0


async def test_it_can_reach_that_weeks_goal(client, member):
    await log(client, 7)
    await log(client, 7)
    third = await log(client, 7)
    assert third["workouts_this_week"] == 3
    assert "ln_goal" in [item["key"] for item in third["line_items"]]


async def test_it_can_complete_that_weeks_quest(client, member, db_session):
    last_week = week_start(local_noon(days_ago(7), ZONE), ZONE)
    await log(client, 7, LEGS, "legs")
    second = await log(client, 7, LEGS, "legs")
    quests = [i for i in second["line_items"] if i["key"] == "ln_quest"]
    assert {"quest": "legs2"} in [q["vars"] for q in quests]
    result = await db_session.execute(select(PointEvent).where(PointEvent.key == "ln_quest"))
    assert all(event.week_start == last_week for event in result.scalars())


async def test_better_than_last_time_compares_with_the_session_before_that_day(client, member):
    await log(client, 7, [{"exercise_id": "bench", "sets": [done(60, 5)]}], "push")
    today = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    await client.put(
        f"/api/workouts/{today['id']}",
        json={"exercises": [{"exercise_id": "bench", "sets": [done(200, 5)]}]},
    )
    await client.post(f"/api/workouts/{today['id']}/finish")
    # Beats the session a week ago, not today's far heavier one.
    body = await log(client, 6, [{"exercise_id": "bench", "sets": [done(80, 5)]}], "push")
    assert "ln_better" in [item["key"] for item in body["line_items"]]


async def test_last_time_shows_the_session_before_that_day_without_overload(client, member):
    await log(client, 7, [{"exercise_id": "bench", "sets": [done(60, 5)]}], "push")
    today = (await client.post("/api/workouts", json={"routine_id": "push"})).json()
    await client.put(
        f"/api/workouts/{today['id']}",
        json={"exercises": [{"exercise_id": "bench", "sets": [done(200, 5)]}]},
    )
    await client.post(f"/api/workouts/{today['id']}/finish")
    body = {"routine_id": "push", "performed_on": days_ago(6).isoformat()}
    started = (await client.post("/api/workouts", json=body)).json()
    bench = next(e for e in started["exercises"] if e["exercise_id"] == "bench")
    assert bench["previous_sets"][0]["load_kg"] == 60
    # What you did last time, not the "beat it" +2.5 kg: this already happened.
    assert bench["sets"][0]["load_kg"] == 60
    assert bench["sets"][0]["done"] is False


async def test_a_pr_counts_and_is_dated_that_day(client, member):
    await log(client, 7)
    body = await log(client, 7, [{"exercise_id": "bench", "sets": [done(100, 5)]}])
    assert "ln_pr" in [item["key"] for item in body["line_items"]]
    stats = (await client.get("/api/me/stats")).json()
    assert stats["prs"][0]["achieved_at"].startswith(days_ago(7).isoformat())


# --- Who hears about it -------------------------------------------------------------------------


async def test_it_isnt_training_now(client, member):
    body = {"routine_id": "push", "performed_on": days_ago(1).isoformat()}
    await client.post("/api/workouts", json=body)
    assert (await client.get("/api/crew/training-now")).json() == []


async def test_starting_one_doesnt_tell_the_crew_youre_coming(
    client, other_client, crew, member, db_session
):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    await log(other_client, 3)
    body = {"routine_id": None, "name": "Old", "performed_on": days_ago(1).isoformat()}
    await client.post("/api/workouts", json=body)
    keys = (await db_session.execute(select(Notification.key))).scalars().all()
    assert "n_behind" not in keys


async def test_the_feed_says_which_day_it_was_for(client, member):
    await log(client, 3)
    item = (await client.get("/api/feed")).json()["items"][0]
    assert item["vars"]["performed_on"] == days_ago(3).isoformat()
    assert item["vars"]["duration_min"] == 0


async def test_the_crew_isnt_told_about_a_goal_in_a_week_thats_over(
    client, other_client, crew, member, db_session
):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    for _ in range(3):
        await log(client, 7)
    keys = (await db_session.execute(select(Notification.key))).scalars().all()
    assert "n_goal" not in keys
