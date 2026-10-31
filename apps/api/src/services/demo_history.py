"""Plan the demo crew's history so standings match the prototype's numbers. Pure, no DB."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from services.catalog import Catalog
from services.training_rules import LoggedSet, week_start

# The prototype's "last time" values per exercise (load or minutes, reps or km).
BASE_LIFTS: dict[str, tuple[float, float]] = {
    "bench": (90, 5), "incline": (30, 10), "fly": (20, 12), "squat": (135, 5), "rdl": (100, 8),
    "legpress": (180, 12), "lunge": (20, 12), "legcurl": (45, 12), "deadlift": (160, 3),
    "row": (77.5, 8), "pullup": (0, 10), "latpull": (60, 10), "ohp": (57.5, 6),
    "lateral": (10, 15), "curl": (35, 10), "dips": (10, 8), "run": (25, 4.2), "rower": (15, 3.2),
}  # fmt: skip
WORKOUT_DAYS = (0, 2, 4, 5)  # Mon, Wed, Fri, Sat
EVENING = time(18, 30)
SETS_PER_EXERCISE = 3


@dataclass(frozen=True, slots=True)
class MemberStats:
    """The prototype numbers for one member."""

    all_points: int
    week_points: int
    goal_streak: int
    sessions: int
    workouts_this_week: int


@dataclass(frozen=True, slots=True)
class PlannedWorkout:
    """One seeded workout."""

    routine_id: str
    finished_at: datetime
    points: int
    exercises: tuple[tuple[str, tuple[LoggedSet, ...]], ...]


def split_points(total: int, parts: int) -> list[int]:
    """`total` in `parts` near-equal integers that add up exactly."""
    if parts <= 0:
        return []
    base, extra = divmod(total, parts)
    return [base + (1 if i < extra else 0) for i in range(parts)]


def past_weeks_layout(sessions: int, previous_streak: int, target: int) -> list[int]:
    """Workouts per past week, newest first: the streak weeks at target, a break week, then 2s."""
    layout = [target] * previous_streak
    remaining = sessions - sum(layout)
    if remaining < 0:
        raise ValueError("not enough sessions for the goal streak")
    layout.append(min(target - 1, remaining))
    remaining -= layout[-1]
    while remaining > 0:
        layout.append(min(2, remaining))
        remaining -= layout[-1]
    return layout


def _past_times(this_week: date, layout: list[int], tz: ZoneInfo) -> list[datetime]:
    times = []
    for weeks_back, count in enumerate(layout, start=1):
        monday = this_week - timedelta(weeks=weeks_back)
        for day in WORKOUT_DAYS[:count]:
            times.append(datetime.combine(monday + timedelta(days=day), EVENING, tz))
    return times


def _this_week_times(now: datetime, this_week: date, count: int, tz: ZoneInfo) -> list[datetime]:
    """`count` moments spread between Monday 00:00 (crew time) and a minute ago."""
    start = datetime.combine(this_week, time(0, 0), tz)
    span = (now - timedelta(minutes=1)) - start
    return [start + span * (i + 1) / (count + 1) for i in range(count)]


def _sets(
    exercise_id: str, is_cardio: bool, strength: float, progress: float
) -> tuple[LoggedSet, ...]:
    a, b = BASE_LIFTS[exercise_id]
    factor = strength * (0.85 + 0.15 * progress)
    if is_cardio:
        return (LoggedSet(minutes=round(a * factor), km=round(b * factor, 1), done=True),)
    load = round(a * factor / 2.5) * 2.5
    return tuple(LoggedSet(load_kg=load, reps=int(b), done=True) for _ in range(SETS_PER_EXERCISE))


def plan_history(
    stats: MemberStats,
    cycle: list[str],
    strength: float,
    catalog: Catalog,
    now: datetime,
    time_zone: str,
    weekly_target: int,
) -> list[PlannedWorkout]:
    # pylint: disable=too-many-arguments,too-many-positional-arguments,too-many-locals
    """Oldest first. Totals, this week's points and count, sessions and streak match `stats`."""
    tz = ZoneInfo(time_zone)
    this_week = week_start(now, time_zone)
    hit_now = stats.workouts_this_week >= weekly_target
    previous_streak = stats.goal_streak - (1 if hit_now else 0)
    past = past_weeks_layout(
        stats.sessions - stats.workouts_this_week, previous_streak, weekly_target
    )
    times = sorted(_past_times(this_week, past, tz)) + _this_week_times(
        now, this_week, stats.workouts_this_week, tz
    )
    past_count = len(times) - stats.workouts_this_week
    points = split_points(stats.all_points - stats.week_points, past_count) + split_points(
        stats.week_points, stats.workouts_this_week
    )
    plans = []
    for index, finished_at in enumerate(times):
        routine = catalog.routine(cycle[index % len(cycle)])
        assert routine is not None
        progress = index / max(1, len(times) - 1)
        exercises = tuple(
            (ex_id, _sets(ex_id, catalog.exercise(ex_id).is_cardio, strength, progress))  # type: ignore[union-attr]
            for ex_id in routine.exercise_ids
        )
        plans.append(PlannedWorkout(routine.id, finished_at, points[index], exercises))
    return plans
