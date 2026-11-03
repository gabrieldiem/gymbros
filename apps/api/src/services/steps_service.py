"""Steps: logging them for a day or a period, what they pay, and the crew climbing by them."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from db.repositories.crew_repository import CrewRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.step_repository import StepRepository
from db.tables.point_event import PointEvent
from db.tables.step_entry import StepEntry
from db.tables.user import User
from services.errors import (
    StepEntryNotFound,
    StepsDayOutOfRange,
    StepsDayTaken,
    StepsEditExpired,
    StepsTooMany,
)
from services.member import Member
from services.steps_rules import (
    MAX_STEPS_PER_DAY,
    days_in,
    points_by_week,
    steps_per_day,
    steps_points,
)
from services.training_rules import local_noon, week_start

Mode = Literal["week", "all"]
_CHART_DAYS = 14
_RECENT_ENTRIES = 20
_CAMP_INTERVALS = 6


@dataclass(frozen=True, slots=True)
class StepRules:
    """What steps pay and how far back they go. From settings.json."""

    per_point: int
    daily_cap: int
    back_days: int
    remove_window: timedelta
    week_summit: int
    all_summit: int


@dataclass(frozen=True, slots=True)
class StepStanding:
    """A member's place on the steps climb."""

    user: User
    steps: int
    position: int


@dataclass(frozen=True, slots=True)
class MyEntry:
    """Something you logged, and until when you can take it back."""

    entry: StepEntry
    removable: bool


@dataclass(frozen=True, slots=True)
class StepsDashboard:
    # pylint: disable=too-many-instance-attributes
    """The steps page."""

    mode: Mode
    summit: int
    standings: tuple[StepStanding, ...]
    today: date
    earliest: date
    taken_days: tuple[date, ...]
    last_days: tuple[tuple[date, int], ...]
    my_week: int
    my_total: int
    my_best_day: int
    entries: tuple[MyEntry, ...]


class StepsService:
    """Logs steps, pays them as point events and builds the steps climb."""

    def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments
        self,
        steps: StepRepository,
        events: PointEventRepository,
        crews: CrewRepository,
        rules: StepRules,
        now: Callable[[], datetime],
    ) -> None:
        self._steps = steps
        self._events = events
        self._crews = crews
        self._rules = rules
        self._now = now

    def _today(self, member: Member) -> date:
        return self._now().astimezone(ZoneInfo(member.crew.time_zone)).date()

    def _week_of(self, member: Member) -> Callable[[date], date]:
        zone = member.crew.time_zone
        return lambda day: week_start(local_noon(day, zone), zone)

    async def log(self, member: Member, start: date, end: date, steps: int) -> StepEntry:
        """Log a total for these days. A day only counts once, and the lock makes that true even
        if the same thing is sent twice at once."""
        today = self._today(member)
        earliest = today - timedelta(days=self._rules.back_days)
        if start > end or start < earliest or end > today:
            raise StepsDayOutOfRange(f"{start}..{end}")
        days = days_in(start, end)
        if steps > len(days) * MAX_STEPS_PER_DAY:
            raise StepsTooMany(str(steps))
        await self._events.lock(f"steps:{member.user.id}")
        if await self._steps.overlapping(member.user.id, start, end):
            raise StepsDayTaken(f"{start}..{end}")
        points = steps_points(len(days), steps, self._rules.per_point, self._rules.daily_cap)
        now = self._now()
        entry = await self._steps.add(
            StepEntry(
                user_id=member.user.id,
                crew_id=member.crew.id,
                start_date=start,
                end_date=end,
                steps=steps,
                points=points,
                created_at=now,
            )
        )
        await self._pay(member, entry, days, now)
        return entry

    async def _pay(
        self, member: Member, entry: StepEntry, days: tuple[date, ...], now: datetime
    ) -> None:
        if entry.points == 0:
            return
        split = points_by_week(days, entry.points, self._week_of(member))
        await self._events.add_all(
            [
                PointEvent(
                    user_id=member.user.id,
                    crew_id=member.crew.id,
                    step_entry_id=entry.id,
                    key="ln_steps",
                    vars={"steps": entry.steps, "days": len(days)},
                    points=points,
                    week_start=week,
                    created_at=now,
                )
                for week, points in split.items()
            ]
        )

    async def remove(self, member: Member, entry_id: uuid.UUID) -> None:
        """Take back something you logged, with its points, soon after logging it."""
        entry = await self._steps.get(entry_id)
        if entry is None or entry.user_id != member.user.id:
            raise StepEntryNotFound(str(entry_id))
        if self._now() > entry.created_at + self._rules.remove_window:
            raise StepsEditExpired(str(entry_id))
        await self._steps.delete(entry)

    async def dashboard(self, member: Member, mode: Mode) -> StepsDashboard:
        """Everything on the steps page."""
        today = self._today(member)
        entries = await self._steps.in_crew(member.crew.id)
        users = await self._crews.members(member.crew.id)
        mine = [e for e in entries if e.user_id == member.user.id]
        my_days = _by_day(mine)
        this_week = self._week_of(member)(today)
        earliest = today - timedelta(days=self._rules.back_days)
        return StepsDashboard(
            mode=mode,
            summit=self._rules.week_summit if mode == "week" else self._rules.all_summit,
            standings=self._standings(member, users, entries, mode, this_week),
            today=today,
            earliest=earliest,
            taken_days=tuple(sorted(day for day in my_days if earliest <= day <= today)),
            last_days=tuple(
                (today - timedelta(days=i), my_days.get(today - timedelta(days=i), 0))
                for i in range(_CHART_DAYS - 1, -1, -1)
            ),
            my_week=sum(n for day, n in my_days.items() if self._week_of(member)(day) == this_week),
            my_total=sum(my_days.values()),
            my_best_day=max(my_days.values(), default=0),
            entries=self._recent(mine),
        )

    def _recent(self, mine: list[StepEntry]) -> tuple[MyEntry, ...]:
        now = self._now()
        newest = sorted(mine, key=lambda e: e.start_date, reverse=True)[:_RECENT_ENTRIES]
        return tuple(
            MyEntry(e, removable=now <= e.created_at + self._rules.remove_window) for e in newest
        )

    def _standings(  # pylint: disable=too-many-arguments,too-many-positional-arguments
        self,
        member: Member,
        users: list[User],
        entries: list[StepEntry],
        mode: Mode,
        this_week: date,
    ) -> tuple[StepStanding, ...]:
        week_of = self._week_of(member)
        totals = {user.id: 0 for user in users}
        for entry in entries:
            if entry.user_id not in totals:
                continue
            for day, steps in steps_per_day(entry.start_date, entry.end_date, entry.steps).items():
                if mode == "all" or week_of(day) == this_week:
                    totals[entry.user_id] += steps
        ranked = sorted(users, key=lambda u: (-totals[u.id], u.display_name))
        return tuple(
            StepStanding(user=user, steps=totals[user.id], position=i + 1)
            for i, user in enumerate(ranked)
        )

    @property
    def rules(self) -> StepRules:
        """What steps pay, for the page to say."""
        return self._rules

    @staticmethod
    def camp_step(summit: int) -> int:
        """Seven camps, evenly up to the summit, like the points climb."""
        return summit // _CAMP_INTERVALS


def _by_day(entries: list[StepEntry]) -> dict[date, int]:
    days: dict[date, int] = {}
    for entry in entries:
        for day, steps in steps_per_day(entry.start_date, entry.end_date, entry.steps).items():
            days[day] = days.get(day, 0) + steps
    return days
