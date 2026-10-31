"""Hall of fame: most improved (against yourself) and crew records."""

from collections.abc import Callable
from datetime import datetime, timedelta

from db.repositories.crew_repository import CrewRepository
from db.repositories.personal_record_repository import PersonalRecordRepository
from db.repositories.workout_repository import WorkoutRepository
from services.climb_rules import longest_goal_streak
from services.climb_service import ClimbService
from services.member import Member
from services.social_types import CrewRecord, HallOfFame, ImprovedMember
from services.training_rules import week_start

RECORD_LIFTS = ("deadlift", "squat", "bench")
PODIUM = 3


def improvement_score(strength_pct: int | None, volume_pct: int | None) -> int | None:
    """The mean of the available improvement metrics, or None without history."""
    values = [v for v in (strength_pct, volume_pct) if v is not None]
    return round(sum(values) / len(values)) if values else None


class HallOfFameService:
    """Builds the Hall of fame for a crew."""

    def __init__(
        self,
        climb: ClimbService,
        crews: CrewRepository,
        records: PersonalRecordRepository,
        workouts: WorkoutRepository,
        weekly_target: int,
        now: Callable[[], datetime],
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._climb = climb
        self._crews = crews
        self._records = records
        self._workouts = workouts
        self._weekly_target = weekly_target
        self._now = now

    async def hall_of_fame(self, member: Member) -> HallOfFame:
        """Most improved top 3 and the crew's records."""
        return HallOfFame(
            most_improved=await self.most_improved(member),
            records=await self._records_of(member),
        )

    async def most_improved(self, member: Member) -> tuple[ImprovedMember, ...]:
        """The top 3 by improvement against themselves (crew-wide counts fetched once)."""
        scored = []
        counts = await self._climb.crew_week_counts(member, self._now())
        for user in await self._crews.members(member.crew.id):
            imp = await self._climb.improvement(Member(user, member.crew), self._now(), counts)
            score = improvement_score(imp.strength_pct, imp.volume_pct)
            if score is not None:
                scored.append(ImprovedMember(user=user, pct=score))
        return tuple(sorted(scored, key=lambda m: (-m.pct, m.user.display_name))[:PODIUM])

    async def _records_of(self, member: Member) -> tuple[CrewRecord, ...]:
        users = {u.id: u for u in await self._crews.members(member.crew.id)}
        records: list[CrewRecord] = []
        for lift in RECORD_LIFTS:
            best = await self._records.heaviest_in_crew(member.crew.id, lift)
            if best is not None and best.user_id in users:
                values: dict[str, int | float | str] = {
                    "exercise_id": lift,
                    "load_kg": best.load_kg,
                    "reps": best.reps,
                }
                records.append(CrewRecord("rec_heaviest", users[best.user_id], values))
        streak = await self._longest_streak(member)
        if streak is not None:
            records.append(streak)
        session = await self._workouts.best_session(member.crew.id)
        if session is not None and session[0] in users:
            records.append(CrewRecord("rec_session", users[session[0]], {"n": session[1]}))
        return tuple(records)

    async def _longest_streak(self, member: Member) -> CrewRecord | None:
        users = {u.id: u for u in await self._crews.members(member.crew.id)}
        since = week_start(self._now(), member.crew.time_zone) - timedelta(weeks=520)
        weeks = await self._workouts.counts_by_user_and_week(member.crew.id, since)
        streaks = {
            user_id: longest_goal_streak(by_week, self._weekly_target)
            for user_id, by_week in weeks.items()
            if user_id in users
        }
        if not streaks or max(streaks.values()) == 0:
            return None
        holder = max(streaks, key=lambda uid: (streaks[uid], users[uid].display_name))
        return CrewRecord("rec_streak", users[holder], {"n": streaks[holder]})
