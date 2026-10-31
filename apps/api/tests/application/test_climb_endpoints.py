"""ATUS Climb over HTTP: rope order, camps, gaps, pips, training now, climbing past people."""

import uuid
from datetime import UTC, datetime, timedelta

from db.tables.point_event import PointEvent
from db.tables.workout import Workout
from db.tables.workout_set import WorkoutSet
from services.training_rules import week_start
from tests.application.conftest import register_on

TZ = "America/Argentina/Buenos_Aires"


async def give_points(db_session, user_id, crew_id, points, when=None):
    """A point event (and its week) for a member, without logging a workout."""
    when = when or datetime.now(UTC)
    db_session.add(
        PointEvent(
            user_id=uuid.UUID(str(user_id)),
            crew_id=uuid.UUID(str(crew_id)),
            key="ln_show",
            vars={},
            points=points,
            week_start=week_start(when, TZ),
            created_at=when,
        )
    )
    await db_session.flush()


async def finish_curl(client):
    workout = (await client.post("/api/workouts", json={"routine_id": None})).json()
    await client.put(
        f"/api/workouts/{workout['id']}",
        json={
            "exercises": [
                {"exercise_id": "curl", "sets": [{"load_kg": 30, "reps": 10, "done": True}]}
            ]
        },
    )
    return (await client.post(f"/api/workouts/{workout['id']}/finish")).json()


async def test_climb_orders_the_crew_by_points_with_camps_and_gaps(
    client, member, other_client, crew, db_session
):
    maxo = await register_on(other_client, "maxo@example.com", "IRONRIDGE")
    await give_points(db_session, maxo["id"], crew.id, 4310)
    await give_points(db_session, member["id"], crew.id, 3880)

    body = (await client.get("/api/climb")).json()
    assert body["mode"] == "all"
    assert (body["camp_step"], body["summit"], body["weekly_target"]) == (1500, 9000, 3)
    assert [(s["display_name"], s["points"], s["camp"]) for s in body["standings"]] == [
        ("Maxo", 4310, 2),
        ("Gabi", 3880, 2),
    ]
    assert [s["is_me"] for s in body["standings"]] == [False, True]
    me = body["me"]
    assert (me["position"], me["points"], me["camp"]) == (2, 3880, 2)
    assert me["above"]["display_name"] == "Maxo"
    assert me["above"]["gap"] == 430
    assert me["below"] is None
    assert me["next_camp"] == {"camp": 3, "points_needed": 620}


async def test_week_mode_counts_only_this_week_on_a_1500_point_scale(
    client, member, crew, db_session
):
    await give_points(
        db_session, member["id"], crew.id, 3000, datetime.now(UTC) - timedelta(weeks=3)
    )
    await give_points(db_session, member["id"], crew.id, 540)

    body = (await client.get("/api/climb", params={"mode": "week"})).json()
    assert (body["camp_step"], body["summit"]) == (250, 1500)
    assert body["me"]["points"] == 540
    assert body["me"]["camp"] == 2
    assert (await client.get("/api/climb")).json()["me"]["points"] == 3540


async def test_members_without_points_are_on_the_rope(client, member, other_client):
    await register_on(other_client, "matex@example.com", "IRONRIDGE")
    body = (await client.get("/api/climb")).json()
    assert sorted(s["display_name"] for s in body["standings"]) == ["Gabi", "Matex"]
    assert all(s["points"] == 0 for s in body["standings"])


async def test_pips_streak_and_training_now(client, member, other_client):
    santi = await register_on(other_client, "santi@example.com", "IRONRIDGE")
    await other_client.post("/api/workouts", json={"routine_id": "legs"})
    for _ in range(3):
        await finish_curl(client)

    body = (await client.get("/api/climb")).json()
    by_name = {s["display_name"]: s for s in body["standings"]}
    assert by_name["Gabi"]["workouts_this_week"] == 3
    assert by_name["Gabi"]["goal_streak"] == 1
    assert by_name["Santi"]["training_now"] is True
    assert by_name["Gabi"]["training_now"] is False
    assert santi["display_name"] == "Santi"


async def test_finishing_reports_the_climb_and_who_you_passed(
    client, member, other_client, crew, db_session
):
    jose = await register_on(other_client, "jose@example.com", "IRONRIDGE")
    await give_points(db_session, jose["id"], crew.id, 30)
    await give_points(db_session, member["id"], crew.id, 1480)

    climb = (await finish_curl(client))["climb"]
    assert climb["points_before"] == 1480
    # showed up 50 + 1 set 5 + 300 kg 3, plus the First tracks badge (50)
    assert climb["points_after"] == 1480 + 50 + 5 + 3 + 50
    assert (climb["camp_before"], climb["camp_after"]) == (0, 1)
    assert climb["passed"] == []


async def test_passing_a_member_is_reported(client, member, other_client, crew, db_session):
    jose = await register_on(other_client, "jose@example.com", "IRONRIDGE")
    await give_points(db_session, jose["id"], crew.id, 30)
    climb = (await finish_curl(client))["climb"]
    assert climb["passed"] == ["Jose"]


async def test_improvement_is_empty_without_history(client, member):
    body = (await client.get("/api/climb")).json()
    assert body["improvement"] == {"strength_pct": None, "volume_pct": None, "workouts_change": 0}


async def test_improvement_compares_against_four_weeks_ago(client, member, crew, db_session):
    user_id = uuid.UUID(member["id"])
    now = datetime.now(UTC)
    for weeks_ago, load in ((9, 100.0), (1, 110.0)):
        finished = now - timedelta(weeks=weeks_ago)
        db_session.add(
            Workout(
                user_id=user_id,
                crew_id=crew.id,
                name="Leg day",
                routine_id="legs",
                started_at=finished,
                finished_at=finished,
                week_start=week_start(finished, TZ),
                volume_kg=load * 5,
                points=50,
                sets=[
                    WorkoutSet(
                        exercise_id="squat",
                        exercise_position=0,
                        set_position=0,
                        load_kg=load,
                        reps=5,
                        done=True,
                    )
                ],
            )
        )
    await db_session.flush()
    from db.repositories.personal_record_repository import PersonalRecordRepository
    from services.scoring_types import RecordSet

    await PersonalRecordRepository(db_session).store(
        user_id, RecordSet("squat", 110.0, 5, 110 * (1 + 5 / 30), True), None, now  # type: ignore[arg-type]
    )
    body = (await client.get("/api/climb")).json()
    assert body["improvement"]["strength_pct"] == 10
    assert body["improvement"]["workouts_change"] == 1


async def test_climb_requires_a_crew_and_a_valid_mode(client, register):
    await register()
    assert (await client.get("/api/climb")).status_code == 403
    await client.post("/api/auth/logout")
    assert (await client.get("/api/climb")).status_code == 401


async def test_climb_rejects_unknown_modes(client, member):
    assert (await client.get("/api/climb", params={"mode": "month"})).status_code == 422


async def test_climb_is_scoped_to_the_crew(client, member, other_client, db_session):
    from db.repositories.crew_repository import CrewRepository
    from services.crew_service import CrewService

    await CrewService(CrewRepository(db_session)).create("Other", "UTC", "OTHERCREW")
    await register_on(other_client, "stranger@example.com", "OTHERCREW")
    names = [s["display_name"] for s in (await client.get("/api/climb")).json()["standings"]]
    assert names == ["Gabi"]
