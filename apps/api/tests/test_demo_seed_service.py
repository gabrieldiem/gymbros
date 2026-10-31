"""The demo seed creates the prototype crew once and is safe to re-run."""

import json

from db.repositories.crew_repository import CrewRepository
from db.repositories.user_repository import UserRepository
from dependencies import password_hasher
from services.demo_seed_service import DEMO_CREW_PATH, DemoSeedService


def _service(db_session) -> DemoSeedService:
    return DemoSeedService(UserRepository(db_session), CrewRepository(db_session), password_hasher)


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
