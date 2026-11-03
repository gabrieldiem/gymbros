"""The demo seed creates the prototype crew once and is safe to re-run."""

import json
from datetime import timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from cli import build_demo_seed
from clock import utc_now
from db.repositories.crew_repository import CrewRepository
from db.repositories.feed_repository import FeedRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.step_repository import StepRepository
from db.repositories.user_repository import UserRepository
from db.tables.point_event import PointEvent
from services.demo_seed_service import DEMO_CREW_PATH, DemoSeedService


def _service(db_session) -> DemoSeedService:
    return build_demo_seed(db_session)


async def test_seed_creates_the_crew_and_five_members(db_session):
    result = await _service(db_session).seed()
    assert result.crew.invite_code == "IRONRIDGE"
    assert result.created_members == ("gabi", "maxo", "santi", "jose", "matex")
    colors = await CrewRepository(db_session).member_colors(result.crew.id)
    assert colors == {"volt", "red", "cyan", "pink", "violet"}


async def test_seed_is_idempotent(db_session):
    first = await _service(db_session).seed()
    second = await _service(db_session).seed()
    assert second.crew.id == first.crew.id
    assert second.created_members == ()


async def test_seeded_members_have_no_password(db_session):
    await _service(db_session).seed()
    user = await UserRepository(db_session).get_by_email("maxo@demo.gymbros.app")
    assert user is not None
    assert user.password_hash is None


def test_demo_numbers_match_the_prototype():
    data = json.loads(DEMO_CREW_PATH.read_text(encoding="utf-8"))
    alls = {m["key"]: m["stats"]["all"] for m in data["members"]}
    assert alls == {"gabi": 3880, "maxo": 4310, "santi": 3725, "jose": 2950, "matex": 2210}


async def test_seeded_points_match_the_prototype(db_session):
    result = await _service(db_session).seed()
    totals = await PointEventRepository(db_session).totals_by_user(result.crew.id)
    users = UserRepository(db_session)
    maxo = await users.get_by_email("maxo@demo.gymbros.app")
    gabi = await users.get_by_email("gabi@demo.gymbros.app")
    assert totals[maxo.id] == 4310
    assert totals[gabi.id] == 3880


async def test_reset_removes_the_demo_crew_and_members(db_session):
    service = _service(db_session)
    first = await service.seed()
    await service.reset()
    assert await CrewRepository(db_session).get_by_invite_code("IRONRIDGE") is None
    assert await UserRepository(db_session).get_by_email("gabi@demo.gymbros.app") is None
    second = await service.seed()
    assert second.crew.id != first.crew.id
    assert len(second.created_members) == 5


async def test_seeded_members_own_the_badges_their_history_earns(db_session):
    from db.repositories.badge_repository import BadgeRepository

    await _service(db_session).seed()
    maxo = await UserRepository(db_session).get_by_email("maxo@demo.gymbros.app")
    unlocked = await BadgeRepository(db_session).unlocked(maxo.id)
    assert {"first", "ironmonth", "legs"} <= set(unlocked)
    totals = await PointEventRepository(db_session).totals_by_user(
        (await CrewRepository(db_session).get_by_invite_code("IRONRIDGE")).id
    )
    assert totals[maxo.id] == 4310  # unlocks in the seed pay nothing extra


async def test_seeded_steps_show_everywhere_without_touching_the_totals(db_session):
    result = await _service(db_session).seed()
    entries = await StepRepository(db_session).in_crew(result.crew.id)
    assert {e.user_id for e in entries} == {
        u.id for u in await CrewRepository(db_session).members(result.crew.id)
    }
    assert all(e.points > 0 for e in entries)
    paid = await db_session.scalar(
        select(func.count()).select_from(PointEvent).where(PointEvent.step_entry_id.is_not(None))
    )
    assert paid == 0


async def test_only_recent_steps_are_posted_and_workouts_stay_on_the_feed(db_session):
    result = await _service(db_session).seed()
    posts = await FeedRepository(db_session).page(result.crew.id, None, 20)
    steps = [p for p in posts if p.kind == "steps"]
    assert 0 < len(steps) <= 15
    assert any(p.kind == "workout" for p in posts)
    assert {"steps", "points", "days", "start_date", "end_date"} == set(steps[0].vars)


async def test_a_reset_takes_the_steps_too(db_session):
    service = _service(db_session)
    result = await service.seed()
    crew_id = result.crew.id
    await service.reset()
    await db_session.flush()
    db_session.expire_all()
    assert await StepRepository(db_session).in_crew(crew_id) == []


async def test_today_is_open_to_log_on_the_demo_crew(db_session):
    result = await _service(db_session).seed()
    entries = await StepRepository(db_session).in_crew(result.crew.id)
    today = utc_now().astimezone(ZoneInfo(result.crew.time_zone)).date()
    assert max(e.end_date for e in entries) == today - timedelta(days=1)
