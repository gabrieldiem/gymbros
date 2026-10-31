"""The Crew tab over HTTP: feed, reactions, comments, nudges, notifications, hall of fame."""

import uuid
from datetime import UTC, datetime, timedelta

from db.repositories.crew_repository import CrewRepository
from db.tables.workout import Workout
from services.crew_service import CrewService
from services.training_rules import week_start
from tests.application.conftest import register_on
from tests.application.test_climb_endpoints import give_points

TZ = "America/Argentina/Buenos_Aires"


def done(load_kg, reps):
    return {"load_kg": load_kg, "reps": reps, "done": True}


async def finish(client, exercises=None, routine_id=None):
    exercises = exercises or [{"exercise_id": "curl", "sets": [done(30, 10)]}]
    workout = (await client.post("/api/workouts", json={"routine_id": routine_id})).json()
    await client.put(f"/api/workouts/{workout['id']}", json={"exercises": exercises})
    return (await client.post(f"/api/workouts/{workout['id']}/finish")).json()


async def inbox(client):
    return (await client.get("/api/notifications")).json()


async def keys(client):
    return [n["key"] for n in (await inbox(client))["items"]]


# --- Feed ----------------------------------------------------------------------------------


async def test_a_finished_workout_is_posted_to_the_crew(client, member, other_client):
    await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    await finish(client, [{"exercise_id": "squat", "sets": [done(100, 5), done(100, 5)]}], "legs")

    feed = (await other_client.get("/api/feed")).json()
    [item] = [i for i in feed["items"] if i["kind"] == "workout"]
    assert item["kind"] == "workout"
    assert item["actor"]["display_name"] == "Gabi"
    assert item["is_mine"] is False
    vars_ = item["vars"]
    assert vars_["name"] == "Leg day"
    assert vars_["sets"] == 2
    assert vars_["volume_kg"] == 1000
    assert vars_["points"] > 0
    assert vars_["exercises"] == [
        {
            "exercise_id": "squat",
            "sets": [
                {"load_kg": 100.0, "reps": 5, "minutes": None, "km": None},
                {"load_kg": 100.0, "reps": 5, "minutes": None, "km": None},
            ],
        }
    ]
    assert item["reactions"] == {"fist": 0, "fire": 0, "mine": []}
    assert (await client.get("/api/feed")).json()["items"][0]["is_mine"] is True


async def test_reaching_a_new_camp_posts_a_rank_up(client, member, crew, db_session):
    await give_points(db_session, member["id"], crew.id, 1480)
    await finish(client)
    kinds = [i["kind"] for i in (await client.get("/api/feed")).json()["items"]]
    assert sorted(kinds) == ["badge", "rank_up", "workout"]  # badge: First tracks
    rank_up = next(
        i for i in (await client.get("/api/feed")).json()["items"] if i["kind"] == "rank_up"
    )
    assert rank_up["vars"] == {"camp": 1}


async def test_feed_pages_with_a_cursor(client, member):
    for _ in range(2):
        await finish(client)  # 2 workout posts + the First tracks badge post
    first = (await client.get("/api/feed", params={"limit": 2})).json()
    assert len(first["items"]) == 2
    assert first["next_before"] is not None
    rest = (
        await client.get("/api/feed", params={"limit": 2, "before": first["next_before"]})
    ).json()
    assert len(rest["items"]) == 1
    assert rest["next_before"] is None


async def test_feed_is_scoped_to_the_crew(client, member, other_client, db_session):
    await CrewService(CrewRepository(db_session)).create("Other", "UTC", "OTHERCREW")
    await register_on(other_client, "stranger@example.com", "OTHERCREW")
    await finish(other_client)
    assert (await client.get("/api/feed")).json()["items"] == []


async def test_members_who_stopped_training_show_up_to_be_nudged(
    client, member, other_client, crew, db_session
):
    matex = await register_on(other_client, "matex@example.com", "IRONRIDGE")
    finished = datetime.now(UTC) - timedelta(days=4, hours=1)
    db_session.add(
        Workout(
            user_id=uuid.UUID(matex["id"]),
            crew_id=crew.id,
            name="Pull day",
            started_at=finished,
            finished_at=finished,
            week_start=week_start(finished, TZ),
            points=50,
        )
    )
    await db_session.flush()
    feed = (await client.get("/api/feed")).json()
    assert [(i["member"]["display_name"], i["days"]) for i in feed["inactive"]] == [("Matex", 4)]


# --- Reactions -----------------------------------------------------------------------------


async def test_reactions_toggle_and_notify_the_owner(client, member, other_client):
    await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    await finish(client)
    items = (await other_client.get("/api/feed")).json()["items"]
    item_id = next(i["id"] for i in items if i["kind"] == "workout")

    on = await other_client.post(f"/api/feed/{item_id}/reactions", json={"kind": "fire"})
    assert on.json() == {"fist": 0, "fire": 1, "mine": ["fire"]}
    off = await other_client.post(f"/api/feed/{item_id}/reactions", json={"kind": "fire"})
    assert off.json() == {"fist": 0, "fire": 0, "mine": []}
    assert (await keys(client)).count("n_react") == 1
    react = next(n for n in (await inbox(client))["items"] if n["key"] == "n_react")
    assert react["vars"] == {"name": "Maxo", "kind": "fire", "item": "workout"}
    assert react["actor"]["display_name"] == "Maxo"


async def test_you_cannot_react_to_your_own_post(client, member):
    await finish(client)
    item_id = (await client.get("/api/feed")).json()["items"][-1]["id"]
    response = await client.post(f"/api/feed/{item_id}/reactions", json={"kind": "fist"})
    assert response.status_code == 409
    assert response.json() == {"detail": {"code": "own_feed_item"}}


async def test_reactions_validate_and_scope(client, member, other_client, db_session):
    await finish(client)
    item_id = (await client.get("/api/feed")).json()["items"][0]["id"]
    await CrewService(CrewRepository(db_session)).create("Other", "UTC", "OTHERCREW")
    await register_on(other_client, "stranger@example.com", "OTHERCREW")
    assert (
        await other_client.post(f"/api/feed/{item_id}/reactions", json={"kind": "fire"})
    ).status_code == 404
    assert (
        await client.post(f"/api/feed/{item_id}/reactions", json={"kind": "heart"})
    ).status_code == 422


# --- Comments ------------------------------------------------------------------------------


async def test_comments_with_text_or_a_quick_reply(client, member, other_client):
    await register_on(other_client, "santi@example.com", "IRONRIDGE")
    await finish(client)
    item_id = (await client.get("/api/feed")).json()["items"][0]["id"]

    text = await other_client.post(
        f"/api/feed/{item_id}/comments", json={"body": "Light weight baby"}
    )
    assert text.status_code == 201
    assert text.json()["body"] == "Light weight baby"
    quick = await client.post(f"/api/feed/{item_id}/comments", json={"quick_key": "q_respect"})
    assert quick.json()["quick_key"] == "q_respect"
    assert quick.json()["body"] is None

    comments = (await client.get("/api/feed")).json()["items"][0]["comments"]
    assert [c["author"]["display_name"] for c in comments] == ["Santi", "Gabi"]
    assert (await keys(client)) == ["n_comment"]


async def test_comments_need_exactly_one_of_body_or_quick_reply(client, member):
    await finish(client)
    item_id = (await client.get("/api/feed")).json()["items"][0]["id"]
    url = f"/api/feed/{item_id}/comments"
    assert (await client.post(url, json={})).status_code == 422
    assert (await client.post(url, json={"body": "x", "quick_key": "q_beast"})).status_code == 422
    assert (await client.post(url, json={"body": "x" * 141})).status_code == 422
    assert (await client.post(url, json={"quick_key": "q_unknown"})).status_code == 422
    assert (await client.post(url, json={"body": "   "})).status_code == 422


# --- Nudges --------------------------------------------------------------------------------


async def test_nudge_once_a_day(client, member, other_client):
    matex = await register_on(other_client, "matex@example.com", "IRONRIDGE")
    first = await client.post("/api/crew/nudges", json={"user_id": matex["id"]})
    assert first.status_code == 201
    assert first.json()["display_name"] == "Matex"
    again = await client.post("/api/crew/nudges", json={"user_id": matex["id"]})
    assert again.status_code == 409
    assert again.json() == {"detail": {"code": "already_nudged"}}
    nudge = (await inbox(other_client))["items"][0]
    assert (nudge["key"], nudge["vars"], nudge["link"]) == ("n_nudge", {"name": "Gabi"}, "/train")


async def test_nudge_rules(client, member):
    me = await client.post("/api/crew/nudges", json={"user_id": member["id"]})
    assert me.status_code == 422
    stranger = await client.post("/api/crew/nudges", json={"user_id": str(uuid.uuid4())})
    assert stranger.status_code == 404


# --- Notifications -------------------------------------------------------------------------


async def test_passing_someone_tells_them(client, member, other_client, crew, db_session):
    jose = await register_on(other_client, "jose@example.com", "IRONRIDGE")
    await give_points(db_session, jose["id"], crew.id, 30)
    await finish(client)
    passed = (await inbox(other_client))["items"][0]
    assert (passed["key"], passed["vars"], passed["link"]) == (
        "n_passed",
        {"name": "Gabi"},
        "/climb",
    )


async def test_hitting_the_weekly_goal_tells_the_crew(client, member, other_client):
    await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    for _ in range(3):
        await finish(client)
    assert "n_goal" in await keys(other_client)
    assert "n_goal" not in await keys(client)


async def test_starting_a_workout_warns_whoever_is_just_ahead(
    client, member, other_client, crew, db_session
):
    maxo = await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    await give_points(db_session, maxo["id"], crew.id, 200)
    await client.post("/api/workouts", json={"routine_id": "push"})
    behind = (await inbox(other_client))["items"][0]
    assert (behind["key"], behind["vars"]) == ("n_behind", {"name": "Gabi", "n": 200})


async def test_inbox_unread_count_and_mark_read(client, member, other_client):
    matex = await register_on(other_client, "matex@example.com", "IRONRIDGE")
    await client.post("/api/crew/nudges", json={"user_id": matex["id"]})
    assert (await inbox(other_client))["unread"] == 1
    assert (await other_client.post("/api/notifications/read")).status_code == 204
    after = await inbox(other_client)
    assert after["unread"] == 0
    assert after["items"][0]["read"] is True


async def test_notifications_need_a_session(client):
    assert (await client.get("/api/notifications")).status_code == 401


# --- Hall of fame --------------------------------------------------------------------------


async def test_hall_of_fame_records(client, member, other_client):
    await register_on(other_client, "jose@example.com", "IRONRIDGE")
    await finish(client, [{"exercise_id": "squat", "sets": [done(140, 3)]}], "legs")
    await finish(other_client, [{"exercise_id": "squat", "sets": [done(120, 5)]}], "legs")
    await finish(other_client, [{"exercise_id": "deadlift", "sets": [done(170, 2)]}], "pull")

    hof = (await client.get("/api/crew/hall-of-fame")).json()
    records = {r["key"] + ":" + str(r["vars"].get("exercise_id", "")): r for r in hof["records"]}
    squat = records["rec_heaviest:squat"]
    assert (squat["holder"]["display_name"], squat["vars"]["load_kg"], squat["vars"]["reps"]) == (
        "Gabi",
        140.0,
        3,
    )
    assert records["rec_heaviest:deadlift"]["holder"]["display_name"] == "Jose"
    assert "rec_session:" in records
    assert hof["most_improved"] == []  # nobody has a month of history yet


async def test_hall_of_fame_requires_a_crew(client, register):
    await register()
    assert (await client.get("/api/crew/hall-of-fame")).status_code == 403
