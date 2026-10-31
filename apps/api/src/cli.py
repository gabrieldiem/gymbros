"""Operator commands. Run from the api's src directory (in the container: /app).

python cli.py seed-demo                                   # the five-person demo crew
python cli.py create-crew "ATUS" America/Argentina/Buenos_Aires
"""

import argparse
import asyncio
import sys

from sqlalchemy.ext.asyncio import AsyncSession

from clock import utc_now
from db.repositories.crew_repository import CrewRepository
from db.repositories.feed_repository import FeedRepository
from db.repositories.personal_record_repository import PersonalRecordRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.user_repository import UserRepository
from db.repositories.workout_repository import WorkoutRepository
from dependencies import password_hasher, session_factory, settings
from services.crew_service import CrewService
from services.demo_seed_service import DemoSeedService, SeedRepositories
from services.errors import DomainError


def build_demo_seed(session: AsyncSession) -> DemoSeedService:
    """The demo seed wired to a session and the configured game settings."""
    repos = SeedRepositories(
        users=UserRepository(session),
        crews=CrewRepository(session),
        workouts=WorkoutRepository(session),
        events=PointEventRepository(session),
        records=PersonalRecordRepository(session),
        feed=FeedRepository(session),
    )
    return DemoSeedService(
        repos,
        password_hasher,
        utc_now,
        weekly_target=settings.game_weekly_target,
        bodyweight_kg=settings.game_bodyweight_kg,
    )


async def seed_demo(reset: bool) -> str:
    """Create the demo crew, members and history; report what was created."""
    async with session_factory() as session, session.begin():
        service = build_demo_seed(session)
        if reset:
            await service.reset()
        result = await service.seed()
    created = ", ".join(result.created_members) or "nobody new"
    return f"Demo crew {result.crew.name!r} (invite code {result.crew.invite_code}): {created}"


async def create_crew(name: str, time_zone: str) -> str:
    """Create a crew and print its invite code."""
    async with session_factory() as session, session.begin():
        crew = await CrewService(CrewRepository(session)).create(name, time_zone)
    return f"Crew {crew.name!r} created. Invite code: {crew.invite_code}"


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="cli.py", description="GYMBROS operator commands")
    commands = parser.add_subparsers(dest="command", required=True)
    seed = commands.add_parser("seed-demo", help="Create the demo crew with history (not in prod)")
    seed.add_argument("--reset", action="store_true", help="Delete the demo crew first")
    create = commands.add_parser("create-crew", help="Create a crew and print its invite code")
    create.add_argument("name")
    create.add_argument("time_zone", help="IANA name, e.g. America/Argentina/Buenos_Aires")
    return parser


def main(argv: list[str]) -> int:
    """Entry point. Returns the process exit code."""
    args = _parser().parse_args(argv)
    if args.command == "seed-demo" and settings.app_env == "production":
        print("Refusing to seed demo accounts in production.", file=sys.stderr)
        return 1
    try:
        if args.command == "seed-demo":
            message = asyncio.run(seed_demo(args.reset))
        else:
            message = asyncio.run(create_crew(args.name, args.time_zone))
    except DomainError as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        return 1
    print(message)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
