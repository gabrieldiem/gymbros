"""Bonuses paid after a workout: quests, crew quest, bounty, badges. Stored as point events."""

import uuid
from collections.abc import Callable
from datetime import datetime

from db.repositories.point_event_repository import PointEventRepository
from db.tables.point_event import PointEvent
from db.tables.workout import Workout
from services.badge_service import BadgeService
from services.member import Member
from services.quest_service import QuestService
from services.scoring_types import LineItem
from services.training_rules import week_start


class BonusService:
    """Runs every bonus rule in order, storing each before the next one looks."""

    def __init__(
        self,
        quests: QuestService,
        badges: BadgeService,
        events: PointEventRepository,
        now: Callable[[], datetime],
    ) -> None:
        self._quests = quests
        self._badges = badges
        self._events = events
        self._now = now

    async def after_workout(
        self, member: Member, workout: Workout, before: dict[uuid.UUID, int], gained: int
    ) -> list[LineItem]:
        """Pay what this workout unlocked. `before` is everyone's all-time points beforehand."""
        paid: list[LineItem] = []
        paid += await self._store(member, workout, await self._quests.claim_quests(member))
        paid += await self._store(member, workout, await self._quests.claim_crew_quest(member, 0))
        so_far = gained + sum(item.points for item in paid)
        paid += await self._store(
            member, workout, await self._quests.claim_bounty(member, before, so_far)
        )
        paid += await self._store(member, workout, await self._badges.check(member))
        return paid

    async def _store(
        self, member: Member, workout: Workout, items: list[LineItem]
    ) -> list[LineItem]:
        week = week_start(self._now(), member.crew.time_zone)
        await self._events.add_all(
            [
                PointEvent(
                    user_id=member.user.id,
                    crew_id=member.crew.id,
                    workout_id=workout.id,
                    key=item.key,
                    vars=dict(item.vars),
                    points=item.points,
                    week_start=week,
                    created_at=self._now(),
                )
                for item in items
            ]
        )
        return items
