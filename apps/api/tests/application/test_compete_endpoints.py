"""Quests, crew quest, bounty, badges, duels, recap and the You tab over HTTP."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from db.tables.duel import Duel
from db.tables.point_event import PointEvent
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


def keys(finished):
    return [i["key"] for i in finished["line_items"]]


async def events_of(db_session, user_id, key):
    result = await db_session.execute(
        select(PointEvent).where(
            PointEvent.user_id == uuid.UUID(str(user_id)), PointEvent.key == key
        )
    )
    return list(result.scalars())


# --- Quests --------------------------------------------------------------------------------


async def test_quest_board_starts_empty(client, member):
    board = (await client.get("/api/quests")).json()
    assert [(q["id"], q["progress"], q["claimed"]) for q in board["quests"]] == [
        ("legs2", 0, False),
        ("ppl", 0, False),
        ("tonnes", 0, False),
        ("cardio", 0, False),
    ]
    assert board["crew_quest"]["goal"] == 4000
    assert board["crew_quest"]["total"] == 0
    assert board["weekly_event"] == "leg_day_x2"
    assert board["ends_at"] > board["week_start"]


async def test_completing_a_quest_pays_its_bonus_once(client, member):
    run = [{"exercise_id": "run", "sets": [{"minutes": 60, "km": 10, "done": True}]}]
    first = await finish(client, run)
    quest = next(i for i in first["line_items"] if i["key"] == "ln_quest")
    assert quest == {"key": "ln_quest", "vars": {"quest": "cardio"}, "points": 100}
    second = await finish(client, run)
    assert "ln_quest" not in keys(second)
    board = (await client.get("/api/quests")).json()
    cardio = next(q for q in board["quests"] if q["id"] == "cardio")
    assert (cardio["progress"], cardio["claimed"]) == (120, True)


async def test_crew_quest_pays_everyone_once(client, member, other_client, crew, db_session):
    maxo = await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    await give_points(db_session, maxo["id"], crew.id, 3950)
    finished = await finish(client)
    assert {"key": "ln_crew_quest", "vars": {}, "points": 200} in finished["line_items"]
    assert len(await events_of(db_session, maxo["id"], "ln_crew_quest")) == 1
    assert "ln_crew_quest" not in keys(await finish(client))
    assert (await client.get("/api/quests")).json()["crew_quest"]["claimed"] is True


async def test_passing_the_leader_claims_the_bounty_once(
    client, member, other_client, crew, db_session
):
    maxo = await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    # The workout itself (58 pts) passes Maxo; badges are paid after the bounty check.
    await give_points(db_session, maxo["id"], crew.id, 50)
    board = (await client.get("/api/quests")).json()
    assert board["bounty"]["target"]["display_name"] == "Maxo"
    finished = await finish(client)
    assert {"key": "ln_bounty", "vars": {"name": "Maxo"}, "points": 150} in finished["line_items"]
    after = (await client.get("/api/quests")).json()["bounty"]
    assert after["target"] is None
    assert after["claimed_by"]["display_name"] == "Gabi"


# --- Badges --------------------------------------------------------------------------------


async def test_badges_list_progress_and_the_first_unlock(client, member):
    badges = {b["id"]: b for b in (await client.get("/api/badges")).json()}
    assert len(badges) == 15
    assert badges["first"]["unlocked_at"] is None
    await finish(client, [{"exercise_id": "squat", "sets": [done(100, 5)]}], "legs")
    badges = {b["id"]: b for b in (await client.get("/api/badges")).json()}
    assert badges["first"]["unlocked_at"] is not None
    assert badges["first"]["crew_count"] == 1
    assert badges["twoplates"]["progress"] == 100
    assert badges["legs"]["progress"] == 1


async def test_ten_comments_unlock_trash_talker(client, member, db_session):
    await finish(client)
    item_id = (await client.get("/api/feed")).json()["items"][-1]["id"]
    for _ in range(10):
        await client.post(f"/api/feed/{item_id}/comments", json={"quick_key": "q_beast"})
    badges = {b["id"]: b for b in (await client.get("/api/badges")).json()}
    assert badges["trash"]["unlocked_at"] is not None
    badge_events = await events_of(db_session, member["id"], "ln_badge")
    [event] = [e for e in badge_events if e.vars["badge"] == "trash"]
    assert event.points == 50


# --- Duels ---------------------------------------------------------------------------------


async def test_duel_lifecycle(client, member, other_client):
    maxo = await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    created = await client.post(
        "/api/duels", json={"opponent_id": maxo["id"], "metric": "points", "stake": "stake_shakes"}
    )
    assert created.status_code == 201
    duel = created.json()
    assert (
        duel["status"],
        duel["challenger"]["display_name"],
        duel["opponent"]["display_name"],
    ) == (
        "pending",
        "Gabi",
        "Maxo",
    )
    invite = (await other_client.get("/api/notifications")).json()["items"][0]
    assert invite["key"] == "n_duel_invite"

    again = await client.post(
        "/api/duels",
        json={"opponent_id": maxo["id"], "metric": "bench_volume", "stake": "stake_plates"},
    )
    assert again.status_code == 409
    assert (await client.post(f"/api/duels/{duel['id']}/accept")).status_code == 404

    accepted = await other_client.post(f"/api/duels/{duel['id']}/accept")
    assert accepted.json()["status"] == "active"
    await finish(client)
    [mine] = (await client.get("/api/duels")).json()
    assert mine["challenger_value"] > 0
    assert mine["opponent_value"] == 0
    assert (await other_client.post(f"/api/duels/{duel['id']}/decline")).status_code == 409


async def test_duel_rules(client, member):
    me = await client.post(
        "/api/duels",
        json={"opponent_id": member["id"], "metric": "points", "stake": "stake_shakes"},
    )
    assert me.status_code == 422
    stranger = await client.post(
        "/api/duels",
        json={"opponent_id": str(uuid.uuid4()), "metric": "points", "stake": "stake_shakes"},
    )
    assert stranger.status_code == 404
    bad = await client.post(
        "/api/duels",
        json={"opponent_id": member["id"], "metric": "deadlift", "stake": "stake_shakes"},
    )
    assert bad.status_code == 422


async def test_an_ended_duel_pays_the_winner(client, member, other_client, crew, db_session):
    maxo = await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    last_week = week_start(datetime.now(UTC), TZ) - timedelta(weeks=1)
    db_session.add(
        Duel(
            crew_id=crew.id,
            challenger_id=uuid.UUID(member["id"]),
            opponent_id=uuid.UUID(maxo["id"]),
            metric="points",
            stake_key="stake_burritos",
            week_start=last_week,
            status="active",
        )
    )
    await give_points(
        db_session, member["id"], crew.id, 300, datetime.now(UTC) - timedelta(weeks=1)
    )
    await give_points(db_session, maxo["id"], crew.id, 200, datetime.now(UTC) - timedelta(weeks=1))
    await client.get("/api/duels")
    [win] = await events_of(db_session, member["id"], "ln_duel")
    assert (win.points, win.vars) == (150, {"name": "Maxo"})
    assert (await events_of(db_session, maxo["id"], "ln_duel")) == []


# --- Recap ---------------------------------------------------------------------------------


async def test_recap_tells_last_weeks_story(client, member, other_client, crew, db_session):
    maxo = await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    last_week = datetime.now(UTC) - timedelta(weeks=1)
    await give_points(db_session, maxo["id"], crew.id, 500, last_week)
    await give_points(db_session, member["id"], crew.id, 300, last_week)
    db_session.add(
        PointEvent(
            user_id=uuid.UUID(maxo["id"]),
            crew_id=crew.id,
            key="ln_pr",
            vars={"exercise_id": "bench", "load_kg": 110, "reps": 3},
            points=100,
            week_start=week_start(last_week, TZ),
            created_at=last_week,
        )
    )
    await db_session.flush()
    recap = (await client.get("/api/recap")).json()
    assert recap["crew_total"] == 900
    assert recap["biggest_climber"]["display_name"] == "Maxo"
    assert recap["biggest_climber_points"] == 600
    assert recap["heaviest_pr"]["load_kg"] == 110
    assert recap["my_points"] == 300
    assert (recap["position_before"], recap["position_after"]) == (1, 2)
    assert recap["weekly_event"] == "leg_day_x2"


# --- You tab -------------------------------------------------------------------------------


async def test_my_stats_heatmap_tonnage_prs_and_history(client, member):
    await finish(client, [{"exercise_id": "squat", "sets": [done(100, 5), done(100, 5)]}], "legs")
    stats = (await client.get("/api/me/stats")).json()
    assert stats["workouts_total"] == 1
    assert stats["badges_unlocked"] >= 1
    assert len(stats["heatmap"]) == 84
    assert stats["heatmap"][-1]["workouts"] == 1
    assert len(stats["weekly_volume"]) == 8
    assert stats["weekly_volume"][-1]["volume_kg"] == 1000
    assert stats["prs"][0]["exercise_id"] == "squat"
    assert stats["history"][0]["sets"] == 2
    assert stats["climb"]["me"]["position"] == 1

    history = (await client.get("/api/me/prs/squat")).json()
    assert len(history) == 1
    assert history[0]["e1rm"] == round(100 * (1 + 5 / 30), 1)
    assert (await client.get("/api/me/prs/run")).status_code == 404
    assert (await client.get("/api/me/prs/nope")).status_code == 404


async def test_rest_timer_setting(client, member):
    assert (await client.get("/api/me")).json()["rest_seconds"] == 90
    assert (await client.patch("/api/me", json={"rest_seconds": 120})).json()["rest_seconds"] == 120
    assert (await client.patch("/api/me", json={"rest_seconds": 5})).status_code == 422
