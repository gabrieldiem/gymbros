"""Seed the five-person demo crew from resources/demo_crew.json, with history. Idempotent."""

import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from db.repositories.crew_repository import CrewRepository
from db.repositories.feed_repository import FeedRepository
from db.repositories.personal_record_repository import PersonalRecordRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.user_repository import UserRepository
from db.repositories.workout_repository import WorkoutRepository
from db.tables.crew import Crew
from db.tables.feed_item import FeedItem
from db.tables.point_event import PointEvent
from db.tables.user import User
from db.tables.workout import Workout
from services.activity_service import workout_post_vars
from services.catalog import load_catalog
from services.crew_service import CrewService
from services.demo_history import MemberStats, PlannedWorkout, plan_history
from services.password_hasher import PasswordHasher
from services.scoring_types import RecordSet
from services.training_rules import effective_load, estimated_1rm, week_start
from services.workout_mapping import to_rows
from services.workout_types import ExerciseEntry

DEMO_CREW_PATH = Path(__file__).resolve().parent.parent / "resources" / "demo_crew.json"
HISTORY_KEY = "ln_history"
# Seeded workouts this recent also get a feed post, so the Crew tab starts populated.
FEED_WINDOW = timedelta(days=10)


@dataclass(frozen=True, slots=True)
class SeedResult:
    """What the seed created. Existing rows are left untouched."""

    crew: Crew
    created_members: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class SeedRepositories:
    """Everything the seed writes to."""

    users: UserRepository
    crews: CrewRepository
    workouts: WorkoutRepository
    events: PointEventRepository
    records: PersonalRecordRepository
    feed: FeedRepository


class DemoSeedService:
    """Creates the demo crew, its members and their history if they don't exist yet."""

    def __init__(
        self,
        repos: SeedRepositories,
        hasher: PasswordHasher,
        now: Callable[[], datetime],
        weekly_target: int,
        bodyweight_kg: float,
        data: dict[str, Any] | None = None,
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._repos = repos
        self._hasher = hasher
        self._now = now
        self._weekly_target = weekly_target
        self._bodyweight_kg = bodyweight_kg
        self._data = data or json.loads(DEMO_CREW_PATH.read_text(encoding="utf-8"))

    async def seed(self) -> SeedResult:
        """Create the crew, then every member not already registered, with their history."""
        crew = await self._ensure_crew()
        password_hash = await self._hasher.hash(self._data["password"])
        created = []
        for member in self._data["members"]:
            if await self._repos.users.get_by_email(member["email"]) is None:
                user = await self._add_member(crew, member, password_hash)
                await self._add_history(crew, user, member)
                created.append(member["key"])
        return SeedResult(crew=crew, created_members=tuple(created))

    async def reset(self) -> None:
        """Delete the demo crew and its members (and everything they logged)."""
        for member in self._data["members"]:
            user = await self._repos.users.get_by_email(member["email"])
            if user is not None:
                await self._repos.users.delete(user)
        crew = await self._repos.crews.get_by_invite_code(self._data["crew"]["invite_code"])
        if crew is not None:
            await self._repos.crews.delete(crew)

    async def _ensure_crew(self) -> Crew:
        spec = self._data["crew"]
        existing = await self._repos.crews.get_by_invite_code(spec["invite_code"])
        if existing is not None:
            return existing
        service = CrewService(self._repos.crews)
        return await service.create(spec["name"], spec["time_zone"], spec["invite_code"])

    async def _add_member(self, crew: Crew, member: dict[str, Any], password_hash: str) -> User:
        user = User(
            email=member["email"],
            password_hash=password_hash,
            display_name=member["display_name"],
            initials=member["initials"],
            color=member["color"],
            language=member["language"],
        )
        await self._repos.users.add(user)
        await self._repos.crews.add_member(crew.id, user.id)
        return user

    async def _add_history(self, crew: Crew, user: User, member: dict[str, Any]) -> None:
        stats = member["stats"]
        plan = plan_history(
            MemberStats(
                stats["all"], stats["week"], stats["streak"], stats["sessions"], stats["ws"]
            ),
            member["history"]["cycle"],
            member["history"]["strength"],
            load_catalog(),
            self._now(),
            crew.time_zone,
            self._weekly_target,
        )
        best: dict[str, RecordSet] = {}
        for planned in plan:
            workout = await self._add_workout(crew, user, planned)
            self._track_bests(best, planned)
            if planned.finished_at >= self._now() - FEED_WINDOW:
                await self._repos.feed.add(self._post(crew, user, workout))
            await self._repos.events.add_all([self._event(crew, user, workout, planned)])
        for record in best.values():
            await self._repos.records.store(user.id, record, None, self._now())

    async def _add_workout(self, crew: Crew, user: User, planned: PlannedWorkout) -> Workout:
        entries = tuple(ExerciseEntry(ex_id, sets) for ex_id, sets in planned.exercises)
        workout = Workout(
            user_id=user.id,
            crew_id=crew.id,
            routine_id=planned.routine_id,
            name=load_catalog().routine(planned.routine_id).name,  # type: ignore[union-attr]
            started_at=planned.finished_at - timedelta(minutes=50 + len(planned.exercises) * 5),
            finished_at=planned.finished_at,
            week_start=week_start(planned.finished_at, crew.time_zone),
            volume_kg=self._volume(planned),
            points=planned.points,
            sets=to_rows(entries),
        )
        return await self._repos.workouts.add(workout)

    def _volume(self, planned: PlannedWorkout) -> float:
        volume = 0.0
        for ex_id, sets in planned.exercises:
            exercise = load_catalog().exercise(ex_id)
            if exercise is None or exercise.is_cardio:
                continue
            for logged in sets:
                load = effective_load(exercise, logged.load_kg, self._bodyweight_kg)
                volume += load * (logged.reps or 0)
        return volume

    def _track_bests(self, best: dict[str, RecordSet], planned: PlannedWorkout) -> None:
        catalog = load_catalog()
        for ex_id, sets in planned.exercises:
            exercise = catalog.exercise(ex_id)
            if exercise is None or exercise.is_cardio:
                continue
            for s in sets:
                e1rm = estimated_1rm(
                    effective_load(exercise, s.load_kg, self._bodyweight_kg), s.reps or 0
                )
                if ex_id not in best or e1rm > best[ex_id].e1rm:
                    best[ex_id] = RecordSet(ex_id, s.load_kg or 0.0, s.reps or 0, e1rm, False)

    @staticmethod
    def _post(crew: Crew, user: User, workout: Workout) -> FeedItem:
        return FeedItem(
            crew_id=crew.id,
            actor_id=user.id,
            kind="workout",
            workout_id=workout.id,
            vars=workout_post_vars(workout),
            created_at=workout.finished_at,
        )

    @staticmethod
    def _event(crew: Crew, user: User, workout: Workout, planned: PlannedWorkout) -> PointEvent:
        return PointEvent(
            user_id=user.id,
            crew_id=crew.id,
            workout_id=workout.id,
            key=HISTORY_KEY,
            vars={},
            points=planned.points,
            week_start=workout.week_start,
            created_at=planned.finished_at,
        )
