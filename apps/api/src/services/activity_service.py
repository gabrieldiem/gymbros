"""What the crew hears when a member trains: feed posts and notifications."""

from collections.abc import Callable
from datetime import datetime

from db.repositories.crew_repository import CrewRepository
from db.repositories.feed_repository import FeedRepository
from db.repositories.point_event_repository import PointEventRepository
from db.tables.feed_item import FeedItem
from db.tables.workout import Workout
from services.member import Member
from services.notifier import Notifier
from services.workout_mapping import to_entries
from services.workout_types import FinishedWorkout


def workout_post_vars(workout: Workout, finished: FinishedWorkout | None = None) -> dict:
    """The snapshot shown on a feed card: stats, PRs and every completed set."""
    score = finished.score if finished else None
    duration = 0
    if workout.finished_at is not None:
        duration = max(1, round((workout.finished_at - workout.started_at).total_seconds() / 60))
    exercises = [
        {
            "exercise_id": entry.exercise_id,
            "sets": [
                {"load_kg": s.load_kg, "reps": s.reps, "minutes": s.minutes, "km": s.km}
                for s in entry.sets
                if s.done
            ],
        }
        for entry in to_entries(workout)
    ]
    return {
        "name": workout.name,
        "routine_id": workout.routine_id,
        "duration_min": duration,
        "sets": score.completed_sets if score else sum(len(e["sets"]) for e in exercises),
        "volume_kg": round(workout.volume_kg or 0),
        "cardio_minutes": score.cardio_minutes if score else 0,
        "points": workout.points or 0,
        "vs_last_pct": score.vs_last_pct if score else None,
        "prs": [
            {"exercise_id": r.exercise_id, "load_kg": r.load_kg, "reps": r.reps}
            for r in (score.records if score else ())
            if r.is_improvement
        ],
        "exercises": [e for e in exercises if e["sets"]],
    }


class ActivityService:
    """Posts finished workouts and rank-ups, and tells the crew what matters."""

    def __init__(
        self,
        feed: FeedRepository,
        crews: CrewRepository,
        events: PointEventRepository,
        notifier: Notifier,
        weekly_target: int,
        close_behind_points: int,
        now: Callable[[], datetime],
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._feed = feed
        self._crews = crews
        self._events = events
        self._notifier = notifier
        self._weekly_target = weekly_target
        self._close_behind = close_behind_points
        self._now = now

    async def workout_finished(self, member: Member, finished: FinishedWorkout) -> None:
        """Feed post (+ rank-up), "X passed you" and "X hit the weekly goal"."""
        workout, climb, me = finished.workout, finished.climb, member.user
        await self._post(member, "workout", workout_post_vars(workout, finished), workout)
        if climb.camp_after > climb.camp_before:
            await self._post(member, "rank_up", {"camp": climb.camp_after}, None)
        name = {"name": me.display_name}
        await self._notifier.send(climb.passed_ids, me.id, "n_passed", name, "/climb")
        if finished.workouts_this_week == self._weekly_target:
            crew = [u.id for u in await self._crews.members(member.crew.id)]
            goal = {**name, "n": self._weekly_target}
            await self._notifier.send(crew, me.id, "n_goal", goal, "/climb")

    async def workout_started(self, member: Member) -> None:
        """Members just ahead (within `close_behind_points`) hear that you're coming."""
        totals = await self._events.totals_by_user(member.crew.id)
        mine = totals.get(member.user.id, 0)
        for user_id, points in totals.items():
            gap = points - mine
            if user_id != member.user.id and 0 < gap <= self._close_behind:
                await self._notifier.send(
                    [user_id],
                    member.user.id,
                    "n_behind",
                    {"name": member.user.display_name, "n": gap},
                    "/climb",
                )

    async def _post(
        self, member: Member, kind: str, variables: dict, workout: Workout | None
    ) -> None:
        await self._feed.add(
            FeedItem(
                crew_id=member.crew.id,
                actor_id=member.user.id,
                kind=kind,
                workout_id=workout.id if workout else None,
                vars=variables,
                created_at=self._now(),
            )
        )
