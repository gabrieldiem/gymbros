"""ATUS Climb standings: points from point_events, camps, pips, streaks, gaps, improvement."""

from datetime import datetime, timedelta

from db.repositories.crew_repository import CrewRepository
from db.repositories.personal_record_repository import PersonalRecordRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.workout_repository import WorkoutRepository
from services.climb_rules import (
    STRENGTH_LIFTS,
    CampScale,
    current_goal_streak,
    next_camp,
    rank_for,
    rank_order,
    strength_change_pct,
    volume_change_pct,
    workouts_change,
)
from services.climb_types import ClimbChange, ClimbView, Improvement, Mode, Standing
from services.member import Member
from services.training_rules import estimated_1rm, week_start

_HISTORY = timedelta(weeks=53)
_IMPROVEMENT_WINDOW = timedelta(weeks=4)


class ClimbService:
    """Builds the rope order. Standings are always sums over point_events."""

    def __init__(
        self,
        crews: CrewRepository,
        events: PointEventRepository,
        workouts: WorkoutRepository,
        records: PersonalRecordRepository,
        scales: dict[Mode, CampScale],
        weekly_target: int,
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._crews = crews
        self._events = events
        self._workouts = workouts
        self._records = records
        self._scales = scales
        self._weekly_target = weekly_target

    async def view(self, member: Member, mode: Mode, now: datetime) -> ClimbView:
        """The standings in this mode, plus the member's own panel."""
        standings = await self.standings(member, mode, now)
        me = next(s for s in standings if s.user.id == member.user.id)
        scale = self._scales[mode]
        return ClimbView(
            mode=mode,
            camp_step=scale.step,
            summit=scale.summit,
            weekly_target=self._weekly_target,
            standings=standings,
            me=me,
            next_camp=next_camp(me.points, scale),
            improvement=await self.improvement(member, now),
        )

    async def standings(self, member: Member, mode: Mode, now: datetime) -> tuple[Standing, ...]:
        """Every crew member, most points first."""
        crew = member.crew
        this_week = week_start(now, crew.time_zone)
        lifetime = await self._events.totals_by_user(crew.id)
        points = (
            lifetime if mode == "all" else await self._events.totals_by_user(crew.id, this_week)
        )
        weeks = await self._workouts.counts_by_user_and_week(crew.id, this_week - _HISTORY)
        training = {w.user_id for w, _ in await self._workouts.active_in_crew(crew.id)}
        users = rank_order(
            await self._crews.members(crew.id),
            key=lambda u: (points.get(u.id, 0), u.display_name),
        )
        return tuple(
            Standing(
                user=user,
                points=points.get(user.id, 0),
                position=index + 1,
                camp=rank_for(points.get(user.id, 0), self._scales[mode]),
                lifetime_points=lifetime.get(user.id, 0),
                workouts_this_week=weeks.get(user.id, {}).get(this_week, 0),
                goal_streak=current_goal_streak(
                    this_week, weeks.get(user.id, {}), self._weekly_target
                ),
                training_now=user.id in training,
            )
            for index, user in enumerate(users)
        )

    async def improvement(self, member: Member, now: datetime) -> Improvement:
        """Strength, volume and workouts against the member's own past."""
        this_week = week_start(now, member.crew.time_zone)
        volume = await self._workouts.volume_by_week(member.user.id, this_week - _HISTORY)
        counts = await self._workouts.counts_by_user_and_week(member.crew.id, this_week - _HISTORY)
        return Improvement(
            strength_pct=strength_change_pct(
                await self._records.best_e1rm_by_exercise(member.user.id),
                await self._best_e1rm_before(member, now - _IMPROVEMENT_WINDOW),
            ),
            volume_pct=volume_change_pct(this_week, volume),
            workouts_change=workouts_change(this_week, counts.get(member.user.id, {})),
        )

    async def _best_e1rm_before(self, member: Member, before: datetime) -> dict[str, float]:
        best: dict[str, float] = {}
        lifts = await self._workouts.completed_lifts_before(
            member.user.id, list(STRENGTH_LIFTS), before
        )
        for exercise_id, load, reps in lifts:
            best[exercise_id] = max(best.get(exercise_id, 0.0), estimated_1rm(load, reps))
        return best

    async def change(self, member: Member, gained: int) -> ClimbChange:
        """The all-time move for `gained` new points (call before storing them)."""
        totals = await self._events.totals_by_user(member.crew.id)
        before = totals.get(member.user.id, 0)
        after = before + gained
        names = {u.id: u.display_name for u in await self._crews.members(member.crew.id)}
        passed = tuple(
            names[user_id]
            for user_id, points in sorted(totals.items(), key=lambda kv: -kv[1])
            if user_id != member.user.id and before < points < after and user_id in names
        )
        scale = self._scales["all"]
        return ClimbChange(before, after, rank_for(before, scale), rank_for(after, scale), passed)
