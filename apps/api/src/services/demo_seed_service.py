"""Seed the five-person demo crew from resources/demo_crew.json. Idempotent."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from db.repositories.crew_repository import CrewRepository
from db.repositories.user_repository import UserRepository
from db.tables.crew import Crew
from db.tables.user import User
from services.crew_service import CrewService
from services.password_hasher import PasswordHasher

DEMO_CREW_PATH = Path(__file__).resolve().parent.parent / "resources" / "demo_crew.json"


@dataclass(frozen=True, slots=True)
class SeedResult:
    """What the seed created. Existing rows are left untouched."""

    crew: Crew
    created_members: tuple[str, ...]


class DemoSeedService:
    """Creates the demo crew and its members if they don't exist yet."""

    def __init__(
        self,
        users: UserRepository,
        crews: CrewRepository,
        hasher: PasswordHasher,
        data: dict[str, Any] | None = None,
    ) -> None:
        self._users = users
        self._crews = crews
        self._crew_service = CrewService(crews)
        self._hasher = hasher
        self._data = data or json.loads(DEMO_CREW_PATH.read_text(encoding="utf-8"))

    async def seed(self) -> SeedResult:
        """Create the crew, then every member not already registered."""
        crew = await self._ensure_crew()
        password_hash = await self._hasher.hash(self._data["password"])
        created = []
        for member in self._data["members"]:
            if await self._users.get_by_email(member["email"]) is None:
                await self._add_member(crew, member, password_hash)
                created.append(member["key"])
        return SeedResult(crew=crew, created_members=tuple(created))

    async def _ensure_crew(self) -> Crew:
        spec = self._data["crew"]
        existing = await self._crews.get_by_invite_code(spec["invite_code"])
        if existing is not None:
            return existing
        return await self._crew_service.create(spec["name"], spec["time_zone"], spec["invite_code"])

    async def _add_member(self, crew: Crew, member: dict[str, Any], password_hash: str) -> None:
        user = User(
            email=member["email"],
            password_hash=password_hash,
            display_name=member["display_name"],
            initials=member["initials"],
            color=member["color"],
            language=member["language"],
        )
        await self._users.add(user)
        await self._crews.add_member(crew.id, user.id)
