"""Operator commands. Run from the api's src directory (in the container: /app).

python cli.py seed-demo                                   # the five-person demo crew
python cli.py create-crew "ATUS" America/Argentina/Buenos_Aires
"""

import argparse
import asyncio
import sys

from db.repositories.crew_repository import CrewRepository
from db.repositories.user_repository import UserRepository
from dependencies import password_hasher, session_factory, settings
from services.crew_service import CrewService
from services.demo_seed_service import DemoSeedService
from services.errors import DomainError


async def seed_demo() -> str:
    """Create the demo crew and members; report what was created."""
    async with session_factory() as session, session.begin():
        service = DemoSeedService(UserRepository(session), CrewRepository(session), password_hasher)
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
    commands.add_parser("seed-demo", help="Create the five-person demo crew (not in production)")
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
            message = asyncio.run(seed_demo())
        else:
            message = asyncio.run(create_crew(args.name, args.time_zone))
    except DomainError as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        return 1
    print(message)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
