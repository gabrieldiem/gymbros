"""The demo seed creates the prototype crew once and is safe to re-run."""

import json

from cli import build_demo_seed
from db.repositories.crew_repository import CrewRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.user_repository import UserRepository
from services.demo_seed_service import DEMO_CREW_PATH, DemoSeedService
from dependencies import password_hasher


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


async def test_seeded_members_can_log_in(db_session):
    await _service(db_session).seed()
    data = json.loads(DEMO_CREW_PATH.read_text(encoding="utf-8"))
    user = await UserRepository(db_session).get_by_email("maxo@demo.gymbros.app")
    assert user is not None
    assert await password_hasher.verify(user.password_hash, data["password"])


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
