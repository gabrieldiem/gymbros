"""Logging steps: what's allowed, what it pays and the crew climbing by them."""

from datetime import timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select, update

from clock import utc_now
from db.tables.point_event import PointEvent
from db.tables.step_entry import StepEntry
from tests.application.conftest import register_on

ZONE = "America/Argentina/Buenos_Aires"


def today():
    return utc_now().astimezone(ZONE and ZoneInfo(ZONE)).date()


def ago(days):
    return (today() - timedelta(days=days)).isoformat()


async def log(client, start=0, end=None, steps=10_000):
    body = {"start_date": ago(start), "steps": steps}
    if end is not None:
        body["end_date"] = ago(end)
    return await client.post("/api/steps", json=body)


async def my_points(client):
    climb = (await client.get("/api/climb?mode=all")).json()
    return next(s["points"] for s in climb["standings"] if s["is_me"])


async def test_a_day_of_steps_goes_into_the_climb(client, member):
    response = await log(client)
    assert response.status_code == 201, response.text
    assert response.json()["points"] == 40
    assert await my_points(client) == 40


async def test_a_period_counts_as_one_total(client, member):
    response = await log(client, start=2, end=0, steps=30_000)
    assert response.json()["points"] == 120
    assert response.json()["start_date"] == ago(2)
    assert response.json()["end_date"] == ago(0)


async def test_a_day_counts_only_once(client, member):
    assert (await log(client, start=1)).status_code == 201
    again = await log(client, start=1)
    assert again.status_code == 409
    assert again.json()["detail"]["code"] == "steps_day_taken"
    overlap = await log(client, start=2, end=0)
    assert overlap.status_code == 409
    assert await my_points(client) == 40


async def test_someone_else_can_log_the_same_day(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    assert (await log(client)).status_code == 201
    assert (await log(other_client)).status_code == 201


async def test_only_today_and_the_last_days(client, member):
    tomorrow = await client.post(
        "/api/steps", json={"start_date": (today() + timedelta(days=1)).isoformat(), "steps": 5}
    )
    assert tomorrow.status_code == 422
    assert tomorrow.json()["detail"]["code"] == "steps_day_out_of_range"
    assert (await log(client, start=8)).status_code == 422
    assert (await log(client, start=7)).status_code == 201


async def test_a_period_has_to_run_forwards(client, member):
    backwards = await log(client, start=0, end=2)
    assert backwards.status_code == 422


async def test_an_impossible_number_is_refused(client, member):
    response = await log(client, steps=100_001)
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "steps_too_many"
    assert (await log(client, steps=0)).status_code == 422


async def test_the_cap_is_enforced_by_the_server(client, member):
    response = await log(client, steps=90_000)
    assert response.json()["points"] == 80


async def test_steps_arent_a_workout(client, member):
    await log(client, steps=20_000)
    assert (await client.get("/api/workouts/week")).json()["workouts"] == 0
    assert (await client.get("/api/feed")).json()["items"] == []
    stats = (await client.get("/api/me/stats")).json()
    assert stats["workouts_total"] == 0


async def test_steps_show_in_this_weeks_climb(client, member):
    await log(client)
    week = (await client.get("/api/climb?mode=week")).json()
    assert next(s["points"] for s in week["standings"] if s["is_me"]) == 40


async def test_it_can_be_taken_back_with_its_points(client, member):
    entry = (await log(client)).json()
    assert (await client.delete(f"/api/steps/{entry['id']}")).status_code == 204
    assert await my_points(client) == 0
    assert (await log(client)).status_code == 201


async def test_only_soon_after_logging_it(client, member, db_session):
    entry = (await log(client)).json()
    await db_session.execute(update(StepEntry).values(created_at=utc_now() - timedelta(hours=49)))
    await db_session.flush()
    db_session.expire_all()
    page = (await client.get("/api/steps")).json()
    assert page["entries"][0]["removable"] is False
    late = await client.delete(f"/api/steps/{entry['id']}")
    assert late.status_code == 409
    assert late.json()["detail"]["code"] == "steps_edit_expired"


async def test_only_your_own_can_be_taken_back(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    entry = (await log(client)).json()
    assert (await other_client.delete(f"/api/steps/{entry['id']}")).status_code == 404


async def test_the_page_has_the_crew_climbing_by_steps(client, other_client, crew, member):
    await register_on(other_client, "maxo@example.com", crew.invite_code)
    await log(client, steps=5_000)
    await log(other_client, steps=9_000)
    page = (await client.get("/api/steps?mode=week")).json()
    assert [s["steps"] for s in page["standings"]] == [9_000, 5_000]
    assert page["standings"][1]["is_me"] is True
    assert page["summit"] == 70_000
    assert page["camp_step"] == page["summit"] // 6
    assert page["steps_per_point"] == 250
    assert page["daily_cap"] == 20_000
    assert (await client.get("/api/steps?mode=all")).json()["summit"] == 1_500_000


async def test_the_page_knows_your_days(client, member):
    await log(client, start=2, end=1, steps=10_001)
    page = (await client.get("/api/steps")).json()
    assert page["today"] == ago(0)
    assert page["earliest"] == ago(7)
    assert page["taken_days"] == [ago(2), ago(1)]
    assert len(page["last_days"]) == 14
    assert page["last_days"][-1]["day"] == ago(0)
    by_day = {d["day"]: d["steps"] for d in page["last_days"]}
    assert by_day[ago(2)] + by_day[ago(1)] == 10_001
    assert page["my_total"] == 10_001
    assert page["my_best_day"] == 5_001


async def test_points_stay_right_when_a_period_crosses_weeks(client, member, db_session):
    entry = (await log(client, start=7, end=0, steps=80_000)).json()
    events = list(await db_session.scalars(select(PointEvent).where(PointEvent.key == "ln_steps")))
    assert sum(e.points for e in events) == entry["points"] == 320
    assert len(events) == 2


async def test_another_crew_doesnt_see_it(client, other_client, member, db_session):
    from db.repositories.crew_repository import CrewRepository
    from services.crew_service import CrewService

    await log(client)
    await CrewService(CrewRepository(db_session)).create("Other", "UTC", "OTHERCREW")
    await register_on(other_client, "stranger@example.com", "OTHERCREW")
    page = (await other_client.get("/api/steps")).json()
    assert [s["display_name"] for s in page["standings"]] == ["Stranger"]


async def test_it_needs_signing_in(other_client):
    assert (await other_client.get("/api/steps")).status_code == 401
