"""Pure training rules shared by scoring, pre-fill and history: e1RM, load, overload, weeks."""

from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from services.catalog import Exercise

BARBELL_STEP_KG = 2.5


@dataclass(frozen=True, slots=True)
class LoggedSet:
    """One set as logged: load + reps, or minutes + km for cardio."""

    load_kg: float | None = None
    reps: int | None = None
    minutes: int | None = None
    km: float | None = None
    done: bool = False


def is_completed(exercise: Exercise, logged: LoggedSet) -> bool:
    """Checked off and not empty (reps for lifts, minutes for cardio)."""
    if not logged.done:
        return False
    if exercise.is_cardio:
        return (logged.minutes or 0) > 0
    return (logged.reps or 0) > 0


def effective_load(exercise: Exercise, load_kg: float | None, bodyweight_kg: float) -> float:
    """Bodyweight exercises lift the body plus any added load."""
    added = load_kg or 0.0
    return bodyweight_kg + added if exercise.type == "bw" else added


def estimated_1rm(load_kg: float, reps: int) -> float:
    """Epley: load × (1 + reps / 30)."""
    return load_kg * (1 + reps / 30)


def overload(exercise: Exercise, last: LoggedSet) -> LoggedSet:
    """The pre-filled set for next time: +2.5 kg on barbell lifts, else +1 rep; cardio +1 min."""
    if exercise.is_cardio:
        return LoggedSet(minutes=(last.minutes or 0) + 1, km=last.km)
    if exercise.barbell and last.load_kg is not None:
        return LoggedSet(load_kg=last.load_kg + BARBELL_STEP_KG, reps=last.reps)
    return replace(last, reps=(last.reps or 0) + 1, done=False, minutes=None, km=None)


def week_start(moment: datetime, time_zone: str) -> date:
    """The Monday of the crew-local week that contains `moment` (must be timezone-aware)."""
    local = moment.astimezone(ZoneInfo(time_zone)).date()
    return local - timedelta(days=local.weekday())


def goal_streak_before(this_week: date, workouts_by_week: dict[date, int], target: int) -> int:
    """Consecutive goal weeks (≥ target workouts) ending the week before `this_week`."""
    streak = 0
    week = this_week - timedelta(weeks=1)
    while workouts_by_week.get(week, 0) >= target:
        streak += 1
        week -= timedelta(weeks=1)
    return streak
