"""The weekly recap: last week's story for the crew and for you."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from db.repositories.crew_repository import CrewRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.workout_repository import WorkoutRepository
from db.tables.user import User
from services.climb_rules import rank_order
from services.hall_of_fame_service import HallOfFameService
from services.member import Member
from services.quest_service import QuestService
from services.social_types import ImprovedMember
from services.training_rules import week_start


@dataclass(frozen=True, slots=True)
class RecapPr:
    """A PR from last week."""

    user: User
    exercise_id: str
    load_kg: float
    reps: int


@dataclass(frozen=True, slots=True)
class Recap:
    # pylint: disable=too-many-instance-attributes
    """Last week's slides."""

    week_start: date
    crew_total: int
    biggest_climber: tuple[User, int, int] | None
    heaviest_pr: RecapPr | None
    my_points: int
    my_workouts: int
    weekly_target: int
    my_volume_kg: float
    position_before: int
    position_after: int
    my_best_pr: RecapPr | None
    most_improved: ImprovedMember | None
    bounty_target: User | None
    bounty_points: int
    weekly_event: str | None


class RecapService:
    """Builds the recap of the week that just ended."""

    def __init__(
        self,
        repos: tuple[PointEventRepository, WorkoutRepository, CrewRepository],
        hall: HallOfFameService,
        quests: QuestService,
        weekly: tuple[int, str | None],
        now: Callable[[], datetime],
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._events, self._workouts, self._crews = repos
        self._hall = hall
        self._quests = quests
        self._weekly_target, self._weekly_event = weekly
        self._now = now

    async def recap(self, member: Member) -> Recap:
        """Last week, for the crew and for the member."""
        crew, me = member.crew, member.user
        this_week = week_start(self._now(), crew.time_zone)
        last_week = this_week - timedelta(weeks=1)
        users = {u.id: u for u in await self._crews.members(crew.id)}
        week_points = await self._events.totals_by_user(crew.id, last_week)
        counts = await self._workouts.counts_by_user_and_week(crew.id, last_week)
        prs = await self._prs(crew.id, last_week, users)
        volume = await self._workouts.volume_by_week(me.id, last_week)
        improved = await self._hall.most_improved(member)
        bounty = await self._quests.bounty(member)
        return Recap(
            week_start=last_week,
            crew_total=sum(week_points.values()),
            biggest_climber=self._biggest(week_points, counts, users, last_week),
            heaviest_pr=prs[0] if prs else None,
            my_points=week_points.get(me.id, 0),
            my_workouts=counts.get(me.id, {}).get(last_week, 0),
            weekly_target=self._weekly_target,
            my_volume_kg=round(volume.get(last_week, 0.0), 1),
            position_before=self._position(
                await self._events.totals_before_week(crew.id, last_week), users, me.id
            ),
            position_after=self._position(
                await self._events.totals_before_week(crew.id, this_week), users, me.id
            ),
            my_best_pr=next((pr for pr in prs if pr.user.id == me.id), None),
            most_improved=improved[0] if improved else None,
            bounty_target=bounty.target,
            bounty_points=bounty.points,
            weekly_event=self._weekly_event,
        )

    @staticmethod
    def _biggest(points, counts, users, week) -> tuple[User, int, int] | None:
        ranked = rank_order(
            [u for u in users.values() if points.get(u.id, 0) > 0],
            key=lambda u: (points.get(u.id, 0), u.display_name),
        )
        if not ranked:
            return None
        top = ranked[0]
        return top, points[top.id], counts.get(top.id, {}).get(week, 0)

    async def _prs(self, crew_id: uuid.UUID, week: date, users: dict) -> list[RecapPr]:
        events = await self._events.week_events(crew_id, week, "ln_pr")
        prs = [
            RecapPr(
                users[e.user_id],
                str(e.vars["exercise_id"]),
                float(e.vars["load_kg"]),
                int(e.vars["reps"]),
            )
            for e in events
            if e.user_id in users
        ]
        return sorted(prs, key=lambda pr: (-pr.load_kg, -pr.reps))

    @staticmethod
    def _position(totals: dict[uuid.UUID, int], users: dict, user_id: uuid.UUID) -> int:
        ordered = rank_order(users.values(), key=lambda u: (totals.get(u.id, 0), u.display_name))
        return next(i + 1 for i, u in enumerate(ordered) if u.id == user_id)
