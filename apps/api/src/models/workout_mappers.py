"""Workout domain objects → API models."""

from dataclasses import asdict

from models.climb_mappers import to_climb_change
from models.workouts import (
    ExerciseOutput,
    FinishResponse,
    LineItemModel,
    PersonalRecordModel,
    SetModel,
    TrainingNowItem,
    WorkoutResponse,
)
from services.training_now_service import ActiveWorkout
from services.training_rules import LoggedSet
from services.workout_types import FinishedWorkout, WorkoutView


def _set(logged: LoggedSet) -> SetModel:
    return SetModel(**asdict(logged))


def to_workout_response(view: WorkoutView) -> WorkoutResponse:
    """The logger's view of an in-progress workout."""
    workout = view.workout
    return WorkoutResponse(
        id=workout.id,
        name=workout.name,
        routine_id=workout.routine_id,
        started_at=workout.started_at,
        exercises=[
            ExerciseOutput(
                exercise_id=e.exercise_id,
                sets=[_set(s) for s in e.sets],
                previous_sets=[_set(s) for s in e.previous_sets],
            )
            for e in view.exercises
        ],
        live_points=view.live.total,
    )


def to_finish_response(finished: FinishedWorkout, weekly_target: int) -> FinishResponse:
    """The finish screen body."""
    workout, score = finished.workout, finished.score
    assert workout.finished_at is not None
    return FinishResponse(
        workout_id=workout.id,
        name=workout.name,
        started_at=workout.started_at,
        finished_at=workout.finished_at,
        total=score.total,
        line_items=[
            LineItemModel(key=i.key, vars=dict(i.vars), points=i.points) for i in score.line_items
        ],
        volume_kg=round(score.volume_kg, 1),
        cardio_minutes=score.cardio_minutes,
        completed_sets=score.completed_sets,
        vs_last_pct=score.vs_last_pct,
        prs=[
            PersonalRecordModel(exercise_id=r.exercise_id, load_kg=r.load_kg, reps=r.reps)
            for r in score.records
            if r.is_improvement
        ],
        workouts_this_week=finished.workouts_this_week,
        weekly_target=weekly_target,
        climb=to_climb_change(finished.climb),
    )


def to_training_now_item(active: ActiveWorkout) -> TrainingNowItem:
    """A training-now chip."""
    return TrainingNowItem.model_validate(
        {
            "user_id": active.user.id,
            "display_name": active.user.display_name,
            "initials": active.user.initials,
            "color": active.user.color,
            "workout_name": active.workout.name,
            "routine_id": active.workout.routine_id,
            "started_at": active.workout.started_at,
            "current_exercise_id": active.current_exercise_id,
        }
    )
