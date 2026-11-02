"""Builds the scoring inputs that come from the database: history and the member's week."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from db.repositories.personal_record_repository import PersonalRecordRepository
from db.repositories.workout_repository import WorkoutRepository
from db.tables.workout import Workout
from services.member import Member
from services.scoring_types import History, WeekState
from services.training_rules import goal_streak_before, local_noon, week_start

# Goal streaks longer than a year pay the same capped amount; no need to look further back.
_STREAK_LOOKBACK = timedelta(weeks=53)
LEG_DAY_X2 = "leg_day_x2"


class ScoringContextBuilder:
    """Reads PRs, the routine's last volume and this week's count for the scoring function."""

    def __init__(
        self,
        workouts: WorkoutRepository,
        records: PersonalRecordRepository,
        weekly_target: int,
        weekly_event: str,
    ) -> None:
        self._workouts = workouts
        self._records = records
        self._weekly_target = weekly_target
        self._weekly_event = weekly_event

    async def history(self, member: Member, workout: Workout, moment: datetime) -> History:
        """Stored PRs, the previous session of the same routine, and that day's stretching."""
        volume, effort = None, 0.0
        if workout.routine_id:
            before = None
            if workout.performed_on:
                before = local_noon(workout.performed_on, member.crew.time_zone)
            volume, effort = await self._workouts.previous_routine_work(
                member.user.id, workout.routine_id, before
            )
        return History(
            personal_records=await self._records.best_e1rm_by_exercise(member.user.id),
            previous_routine_volume_kg=volume,
            previous_routine_effort_km=effort,
            stretched_that_day=await self._stretched_on(member, moment),
        )

    async def _stretched_on(self, member: Member, moment: datetime) -> bool:
        zone = ZoneInfo(member.crew.time_zone)
        day = moment.astimezone(zone).date()
        start = datetime.combine(day, time(0, 0), zone)
        return await self._workouts.stretched_between(
            member.user.id, start, start + timedelta(days=1)
        )

    async def week(self, member: Member, moment: datetime) -> WeekState:
        """Workouts so far in the crew-local week of `moment` and the goal streak before it."""
        this_week = week_start(moment, member.crew.time_zone)
        counts = await self._workouts.count_by_week(member.user.id, this_week - _STREAK_LOOKBACK)
        return WeekState(
            workouts_before=counts.get(this_week, 0),
            previous_goal_streak=goal_streak_before(this_week, counts, self._weekly_target),
            leg_event_active=self._weekly_event == LEG_DAY_X2,
        )
