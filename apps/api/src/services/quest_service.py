"""Weekly quests, the crew quest and the bounty: progress and claiming (once per week each)."""

import uuid
from collections.abc import Callable
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from db.repositories.crew_repository import CrewRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.user_repository import UserRepository
from db.repositories.workout_repository import WorkoutRepository
from db.tables.point_event import PointEvent
from services.catalog import Catalog
from services.compete_types import BountyView, CrewQuestView, QuestBoard, QuestView
from services.member import Member
from services.quests import WeekActivity, load_quests, quest_progress, week_activity
from services.scoring_types import LineItem
from services.training_rules import week_start
from services.workout_mapping import to_workout_log

QUEST_KEY = "ln_quest"
CREW_QUEST_KEY = "ln_crew_quest"
BOUNTY_KEY = "ln_bounty"


class QuestService:
    # pylint: disable=too-many-instance-attributes
    """Reads progress and pays bonuses. Every bonus is a point event with a line-item key."""

    def __init__(
        self,
        repos: tuple[WorkoutRepository, PointEventRepository, CrewRepository, UserRepository],
        catalog: Catalog,
        settings: dict[str, int | float | str],
        now: Callable[[], datetime],
    ) -> None:
        self._workouts, self._events, self._crews, self._users = repos
        self._catalog = catalog
        self._bodyweight = float(settings["bodyweight_kg"])
        self._crew_goal = int(settings["crew_quest_goal"])
        self._crew_bonus = int(settings["crew_quest"])
        self._bounty = int(settings["bounty"])
        self._duel_points = int(settings["duel_win"])
        self._weekly_event = str(settings["weekly_event"]) or None
        self._now = now

    async def board(self, member: Member) -> QuestBoard:
        """Everything on the Quests tab for this week."""
        week = week_start(self._now(), member.crew.time_zone)
        activity = await self._activity(member)
        quests = []
        for quest in load_quests():
            claimed = await self._claimed(member, quest.id)
            quests.append(QuestView(quest, quest_progress(quest, activity), claimed))
        return QuestBoard(
            week_start=week,
            ends_at=datetime.combine(
                week + timedelta(days=7), time(0, 0), ZoneInfo(member.crew.time_zone)
            ),
            quests=tuple(quests),
            crew_quest=await self._crew_quest(member),
            bounty=await self.bounty(member),
            weekly_event=self._weekly_event,
            duel_points=self._duel_points,
        )

    async def claim_quests(self, member: Member) -> list[LineItem]:
        """Pay every quest completed this week and not paid yet."""
        activity = await self._activity(member)
        items = []
        for quest in load_quests():
            done = quest_progress(quest, activity) >= quest.goal
            if done and not await self._claimed(member, quest.id):
                items.append(LineItem(QUEST_KEY, {"quest": quest.id}, quest.bonus))
        return items

    async def claim_crew_quest(self, member: Member, gained: int) -> list[LineItem]:
        """When the crew's week reaches the goal, everyone gets the bonus (once per week)."""
        view = await self._crew_quest(member)
        if view.claimed or view.total + gained < view.goal:
            return []
        week = week_start(self._now(), member.crew.time_zone)
        others = [u.id for u, _ in view.shares if u.id != member.user.id]
        await self._events.add_all(
            [self._event(member, uid, CREW_QUEST_KEY, {}, self._crew_bonus, week) for uid in others]
        )
        return [LineItem(CREW_QUEST_KEY, {}, self._crew_bonus)]

    async def claim_bounty(
        self, member: Member, before: dict[uuid.UUID, int], gained: int
    ) -> list[LineItem]:
        """Passing this week's bounty target (the all-time leader) pays the bounty once."""
        bounty = await self.bounty(member, before)
        if bounty.target is None or bounty.target.id == member.user.id:
            return []
        mine = before.get(member.user.id, 0)
        if not mine < bounty.target_points < mine + gained:
            return []
        return [LineItem(BOUNTY_KEY, {"name": bounty.target.display_name}, self._bounty)]

    async def bounty(
        self, member: Member, totals: dict[uuid.UUID, int] | None = None
    ) -> BountyView:
        """The bounty is on the all-time leader until someone passes them this week."""
        week = week_start(self._now(), member.crew.time_zone)
        claimed = await self._events.week_events(member.crew.id, week, BOUNTY_KEY)
        if claimed:
            users = await self._users.get_many({claimed[0].user_id})
            return BountyView(None, 0, self._bounty, users.get(claimed[0].user_id))
        totals = totals if totals is not None else await self._events.totals_by_user(member.crew.id)
        leader_id = max(totals, key=lambda uid: totals[uid], default=None)
        leader = (await self._users.get_many({leader_id})).get(leader_id) if leader_id else None
        return BountyView(leader, totals.get(leader_id, 0) if leader_id else 0, self._bounty, None)

    async def _activity(self, member: Member) -> WeekActivity:
        week = week_start(self._now(), member.crew.time_zone)
        workouts = await self._workouts.finished_in_week(member.user.id, week)
        logs = [to_workout_log(w, self._catalog) for w in workouts]
        return week_activity(logs, self._bodyweight)

    async def _claimed(self, member: Member, quest_id: str) -> bool:
        week = week_start(self._now(), member.crew.time_zone)
        return await self._events.user_has(member.user.id, week, QUEST_KEY, quest=quest_id)

    async def _crew_quest(self, member: Member) -> CrewQuestView:
        week = week_start(self._now(), member.crew.time_zone)
        totals = await self._events.totals_by_user(member.crew.id, week)
        users = await self._crews.members(member.crew.id)
        shares = tuple(sorted(((u, totals.get(u.id, 0)) for u in users), key=lambda s: -s[1]))
        return CrewQuestView(
            goal=self._crew_goal,
            bonus=self._crew_bonus,
            total=sum(points for _, points in shares),
            shares=shares,
            claimed=await self._events.crew_has(member.crew.id, week, CREW_QUEST_KEY),
        )

    def _event(self, member: Member, user_id, key, variables, points, week) -> PointEvent:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        return PointEvent(
            user_id=user_id,
            crew_id=member.crew.id,
            key=key,
            vars=variables,
            points=points,
            week_start=week,
            created_at=self._now(),
        )
