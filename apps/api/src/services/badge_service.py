"""Badges: gather a member's stats, list progress, and unlock (each pays once, ever)."""

from collections.abc import Callable
from datetime import datetime, timedelta

from db.repositories.badge_repository import BadgeRepository
from db.repositories.feed_repository import FeedRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.workout_repository import WorkoutRepository
from db.repositories.workout_stats_repository import WorkoutStatsRepository
from db.tables.feed_item import FeedItem
from db.tables.point_event import PointEvent
from services.badges import (
    BadgeStats,
    badge_progress,
    is_unlocked,
    load_badges,
    local_hours_and_gaps,
)
from services.catalog import Catalog
from services.climb_rules import longest_goal_streak
from services.compete_types import BadgeView
from services.member import Member
from services.scoring_types import LineItem
from services.training_rules import week_start

BADGE_KEY = "ln_badge"
_ALL_TIME = timedelta(weeks=520)


class BadgeService:
    """Reads badge progress and unlocks new badges."""

    def __init__(
        self,
        repos: tuple[
            WorkoutRepository,
            WorkoutStatsRepository,
            PointEventRepository,
            FeedRepository,
            BadgeRepository,
        ],
        catalog: Catalog,
        weekly_target: int,
        now: Callable[[], datetime],
    ) -> None:
        self._workouts, self._stats, self._events, self._feed, self._badges = repos
        self._catalog = catalog
        self._weekly_target = weekly_target
        self._now = now

    async def stats(self, member: Member) -> BadgeStats:
        """Everything the badge metrics read."""
        user_id, crew = member.user.id, member.crew
        since = week_start(self._now(), crew.time_zone) - _ALL_TIME
        weeks = (await self._workouts.counts_by_user_and_week(crew.id, since)).get(user_id, {})
        times = await self._stats.finished_times(user_id)
        dawn, night, comebacks = local_hours_and_gaps(times, crew.time_zone)
        reactions, comments = await self._feed.count_by_user(user_id)
        totals = await self._events.totals_by_user(crew.id)
        leg_ids = [e.id for e in self._catalog.exercises if e.group == "Legs"]
        return BadgeStats(
            workouts=len(times),
            better_than_last_time=await self._events.count_key(user_id, "ln_better"),
            best_squat_kg=await self._stats.best_load(user_id, "squat"),
            lifetime_volume_kg=await self._stats.lifetime_volume(user_id),
            longest_goal_streak=longest_goal_streak(weeks, self._weekly_target),
            best_bench_kg=await self._stats.best_load(user_id, "bench"),
            dawn_workouts=dawn,
            leg_days=await self._stats.workouts_with(user_id, leg_ids),
            bounties=await self._events.count_key(user_id, "ln_bounty"),
            crew_quests=await self._events.count_key(user_id, "ln_crew_quest"),
            reactions_given=reactions,
            comments_written=comments,
            night_workouts=night,
            comebacks=comebacks,
            total_points=totals.get(user_id, 0),
        )

    async def views(self, member: Member) -> tuple[BadgeView, ...]:
        """Every badge with progress, unlock time and how many in the crew have it."""
        stats = await self.stats(member)
        unlocked = await self._badges.unlocked(member.user.id)
        counts = await self._badges.crew_counts(member.crew.id)
        return tuple(
            BadgeView(b, badge_progress(b, stats), unlocked.get(b.id), counts.get(b.id, 0))
            for b in load_badges()
        )

    async def check(self, member: Member) -> list[LineItem]:
        """Unlock every badge newly reached (records it and posts to the feed).

        Returns the line items; the caller stores them as point events.
        """
        stats = await self.stats(member)
        unlocked = await self._badges.unlocked(member.user.id)
        items = []
        for badge in load_badges():
            if badge.id not in unlocked and is_unlocked(badge, stats):
                items.append(await self._unlock(member, badge.id, badge.points))
        return items

    async def _unlock(self, member: Member, badge_id: str, points: int) -> LineItem:
        now = self._now()
        await self._badges.add(member.user.id, badge_id, now)
        await self._feed.add(
            FeedItem(
                crew_id=member.crew.id,
                actor_id=member.user.id,
                kind="badge",
                vars={"badge": badge_id, "points": points},
                created_at=now,
            )
        )
        return LineItem(BADGE_KEY, {"badge": badge_id}, points)

    async def check_and_store(self, member: Member) -> None:
        """Unlock and pay badges outside a workout (reactions, comments)."""
        items = await self.check(member)
        if not items:
            return
        week = week_start(self._now(), member.crew.time_zone)
        await self._events.add_all(
            [
                PointEvent(
                    user_id=member.user.id,
                    crew_id=member.crew.id,
                    key=item.key,
                    vars=dict(item.vars),
                    points=item.points,
                    week_start=week,
                    created_at=self._now(),
                )
                for item in items
            ]
        )
