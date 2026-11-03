"""Changing a finished workout for up to 2 days: it's rescored as things stood when it was logged,
and nothing else moves."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select, update

from clock import utc_now
from db.tables.feed_item import FeedItem
from db.tables.notification import Notification
from db.tables.personal_record import PersonalRecord
from db.tables.point_event import PointEvent
from tests.application.conftest import register_on

ZONE = "America/Argentina/Buenos_Aires"


def bench(load_kg=60, reps=5):
    return {"exercise_id": "bench", "sets": [{"load_kg": load_kg, "reps": reps, "done": True}]}


async def finish(client, exercises=None, routine_id=None, performed_on=None):
    body = {"routine_id": routine_id, "name": "Morning"}
    if performed_on:
        body["performed_on"] = performed_on.isoformat()
    workout = (await client.post("/api/workouts", json=body)).json()
    saved = await client.put(
        f"/api/workouts/{workout['id']}", json={"exercises": exercises or [bench()]}
    )
    assert saved.status_code == 200, saved.text
    finished = await client.post(f"/api/workouts/{workout['id']}/finish")
    assert finished.status_code == 200, finished.text
    return finished.json()


async def edit(client, workout_id, exercises, **fields):
    return await client.put(
        f"/api/workouts/{workout_id}/edit", json={"exercises": exercises, **fields}
    )


async def edited(client, workout_id, exercises, **fields):
    response = await edit(client, workout_id, exercises, **fields)
    assert response.status_code == 200, response.text
    return response.json()


async def my_total(client):
    climb = (await client.get("/api/climb?mode=all")).json()
    return sum(row["points"] for row in climb["standings"])  # Gabi is alone in these tests.


def keys(detail):
    return [item["key"] for item in detail["line_items"]]


async def age(db_session, workout_id, **ago):
    """Pretend the workout's points arrived that long ago."""
    await db_session.execute(
        update(PointEvent)
        .where(PointEvent.workout_id == workout_id)
        .values(created_at=utc_now() - timedelta(**ago))
    )
    await db_session.flush()


async def test_more_work_pays_more_and_the_standings_follow(client, member):
    finished = await finish(client)
    total = await my_total(client)
    three_sets = {**bench(), "sets": bench()["sets"] * 3}
    detail = await edited(client, finished["workout_id"], [three_sets])
    assert detail["sets"] == 3
    assert detail["volume_kg"] == 900
    assert detail["points"] > finished["total"]
    assert sum(item["points"] for item in detail["line_items"]) == detail["points"]
    assert await my_total(client) == total + detail["points"] - finished["total"]


async def test_saving_the_same_thing_changes_nothing(client, member):
    finished = await finish(client)
    total = await my_total(client)
    first = await edited(client, finished["workout_id"], [bench()])
    second = await edited(client, finished["workout_id"], [bench()])
    assert first["points"] == second["points"] == finished["total"]
    assert sorted(keys(second)) == sorted(item["key"] for item in finished["line_items"])
    assert await my_total(client) == total


async def test_the_scoring_lines_come_before_the_bonuses(client, member):
    finished = await finish(client)
    detail = await edited(client, finished["workout_id"], [bench()])
    assert keys(detail)[0] == "ln_show"
    assert keys(detail)[-1] == "ln_badge"


async def test_a_badge_already_earned_stays_and_isnt_paid_twice(client, member):
    finished = await finish(client)
    assert "ln_badge" in [item["key"] for item in finished["line_items"]]
    detail = await edited(client, finished["workout_id"], [bench(40, 3)])
    assert keys(detail).count("ln_badge") == 1


async def test_a_pr_goes_when_the_set_that_made_it_goes(client, member, db_session):
    await finish(client, [bench(60)])
    best = await finish(client, [bench(80)])
    assert "ln_pr" in [item["key"] for item in best["line_items"]]

    lowered = await edited(client, best["workout_id"], [bench(50)])
    assert "ln_pr" not in keys(lowered)
    record = await db_session.scalar(
        select(PersonalRecord).where(PersonalRecord.exercise_id == "bench")
    )
    await db_session.refresh(record)
    assert record.load_kg == 60

    raised = await edited(client, best["workout_id"], [bench(90)])
    assert keys(raised).count("ln_pr") == 1
    await db_session.refresh(record)
    assert record.load_kg == 90


async def test_a_workout_is_compared_with_what_came_before_it_not_after(client, member, db_session):
    first = await finish(client, [bench(60)])
    await finish(client, [bench(100)])
    # 80 beats nothing logged before this one, as its first bench: still no PR, and 100 stands.
    detail = await edited(client, first["workout_id"], [bench(80)])
    assert "ln_pr" not in keys(detail)
    record = await db_session.scalar(
        select(PersonalRecord).where(PersonalRecord.exercise_id == "bench")
    )
    await db_session.refresh(record)
    assert record.load_kg == 100


async def test_taking_an_exercise_out_removes_a_pr_only_it_held(client, member, db_session):
    finished = await finish(client, [bench(60), {"exercise_id": "ohp", "sets": bench(40)["sets"]}])
    await edited(client, finished["workout_id"], [bench(60)])
    rows = await db_session.scalars(select(PersonalRecord.exercise_id))
    assert list(rows) == ["bench"]


async def test_the_weekly_goal_is_paid_once_whichever_workout_changes(client, member):
    first = await finish(client)
    await finish(client)
    third = await finish(client)
    assert "ln_goal" in [item["key"] for item in third["line_items"]]
    early = await edited(client, first["workout_id"], [bench(70)])
    assert "ln_goal" not in keys(early)
    late = await edited(client, third["workout_id"], [bench(70)])
    assert keys(late).count("ln_goal") == 1


async def test_a_routine_isnt_compared_with_itself(client, member):
    await finish(client, [bench(60)], routine_id="push")
    finished = await finish(client, [bench(60)], routine_id="push")
    detail = await edited(client, finished["workout_id"], [bench(100)])
    assert "ln_better" in keys(detail)
    alone = await edited(client, finished["workout_id"], [bench(60)])
    assert "ln_better" not in keys(alone)


async def test_stretching_can_be_changed_without_counting_against_itself(client, member):
    stretch = [{"exercise_id": "stretch", "sets": [{"minutes": 5, "done": True}]}]
    finished = await finish(client, stretch)
    longer = [{"exercise_id": "stretch", "sets": [{"minutes": 10, "done": True}]}]
    detail = await edited(client, finished["workout_id"], longer)
    assert "ln_stretch" in keys(detail)


async def test_an_emptied_workout_is_refused(client, member):
    finished = await finish(client)
    empty = [{"exercise_id": "bench", "sets": [{"load_kg": None, "reps": None, "done": False}]}]
    response = await edit(client, finished["workout_id"], empty)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "workout_empty"


async def test_an_unknown_exercise_is_refused(client, member):
    finished = await finish(client)
    response = await edit(client, finished["workout_id"], [{"exercise_id": "nope", "sets": []}])
    assert response.status_code in (404, 422)


async def test_the_name_and_gym_can_change_too(client, member):
    finished = await finish(client)
    detail = await edited(client, finished["workout_id"], [bench()], name=" Evening ", gym="Home")
    assert detail["name"] == "Evening"
    assert detail["gym"] == "Home"
    kept = await edited(client, finished["workout_id"], [bench()])
    assert kept["gym"] == "Home"
    cleared = await edited(client, finished["workout_id"], [bench()], gym=None)
    assert cleared["gym"] is None


async def test_the_two_days_count_from_when_it_was_logged(client, member, db_session):
    finished = await finish(client)
    workout_id = finished["workout_id"]
    fresh = (await client.get(f"/api/me/workouts/{workout_id}")).json()
    assert fresh["editable_until"] is not None

    await age(db_session, workout_id, hours=47)
    assert (await edit(client, workout_id, [bench()])).status_code == 200

    await age(db_session, workout_id, hours=49)
    late = await edit(client, workout_id, [bench(100)])
    assert late.status_code == 409
    assert late.json()["detail"]["code"] == "workout_edit_expired"
    db_session.expire_all()
    assert (await client.get(f"/api/me/workouts/{workout_id}")).json()["editable_until"] is None


async def test_editing_keeps_the_clock_running_from_the_first_time(client, member, db_session):
    finished = await finish(client)
    workout_id = finished["workout_id"]
    await age(db_session, workout_id, hours=47)
    await edited(client, workout_id, [bench(70)])
    db_session.expire_all()
    detail = (await client.get(f"/api/me/workouts/{workout_id}")).json()
    assert detail["editable_until"] is not None
    left = datetime.fromisoformat(detail["editable_until"])
    assert left < utc_now() + timedelta(hours=2)


async def test_a_past_day_gets_its_two_days_from_when_you_logged_it(client, member):
    today = utc_now().astimezone(ZoneInfo(ZONE)).date()
    finished = await finish(client, performed_on=today - timedelta(days=5))
    detail = await edited(client, finished["workout_id"], [bench(70)])
    assert detail["performed_on"] == (today - timedelta(days=5)).isoformat()
    moved = datetime.fromisoformat(detail["finished_at"])
    assert moved == datetime.fromisoformat(finished["finished_at"])


async def test_the_crew_sees_the_same_post_corrected_and_marked(client, member, db_session):
    finished = await finish(client)
    posts_before = len(list(await db_session.scalars(select(FeedItem.id))))
    detail = await edited(client, finished["workout_id"], [bench(70)])
    db_session.expire_all()
    posts = list(await db_session.scalars(select(FeedItem).where(FeedItem.kind == "workout")))
    assert len(posts) == 1
    assert len(list(await db_session.scalars(select(FeedItem.id)))) == posts_before
    assert posts[0].vars["edited"] is True
    assert posts[0].vars["points"] == detail["points"]
    assert posts[0].vars["volume_kg"] == 350
    assert posts[0].vars["exercises"][0]["sets"][0]["load_kg"] == 70
    assert posts[0].vars["original"]["exercises"][0]["sets"][0]["load_kg"] == 60
    assert posts[0].vars["original"]["points"] == finished["total"]


async def test_the_post_compares_with_how_it_was_first_posted(client, member, db_session):
    finished = await finish(client)
    await edited(client, finished["workout_id"], [bench(70)], name="Second")
    await edited(client, finished["workout_id"], [bench(80)], name="Third")
    db_session.expire_all()
    post = await db_session.scalar(select(FeedItem).where(FeedItem.kind == "workout"))
    assert post.vars["name"] == "Third"
    assert post.vars["original"]["name"] == "Morning"
    assert post.vars["original"]["exercises"][0]["sets"][0]["load_kg"] == 60


async def test_editing_doesnt_notify_anyone(client, other_client, crew, member, db_session):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    await finish(other_client)
    finished = await finish(client, [bench(10, 1)])
    before = len(list(await db_session.scalars(select(Notification.id))))
    big = {**bench(200, 10), "sets": bench(200, 10)["sets"] * 10}
    await edited(client, finished["workout_id"], [big])
    assert len(list(await db_session.scalars(select(Notification.id)))) == before


async def test_only_your_own_finished_workouts(client, other_client, crew, member):
    finished = await finish(client)
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    theirs = await edit(other_client, finished["workout_id"], [bench()])
    assert theirs.status_code == 404
    running = (await client.post("/api/workouts", json={"name": "Now"})).json()
    assert (await edit(client, running["id"], [bench()])).status_code == 404
