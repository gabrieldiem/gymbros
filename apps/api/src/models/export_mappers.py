"""The export as the file's models."""

from dataclasses import asdict

from models.export import (
    ExportAccount,
    ExportExercise,
    ExportPointLine,
    ExportRecord,
    ExportResponse,
    ExportSet,
    ExportWorkout,
)
from models.gyms import to_gym_model
from models.photos import photo_url
from services.catalog import Catalog
from services.export_service import Export, ExportedWorkout
from services.workout_mapping import to_entries


def _workout(item: ExportedWorkout, catalog: Catalog) -> ExportWorkout:
    workout = item.workout
    assert workout.finished_at is not None
    exercises = []
    for entry in to_entries(workout):
        known = catalog.exercise(entry.exercise_id)
        exercises.append(
            ExportExercise(
                exercise_id=entry.exercise_id,
                name=entry.custom_name or (known.name if known else entry.exercise_id),
                sets=[ExportSet(**asdict(logged)) for logged in entry.sets],
            )
        )
    return ExportWorkout(
        id=workout.id,
        name=workout.name,
        routine_id=workout.routine_id,
        gym=workout.gym_name,
        performed_on=workout.performed_on,
        started_at=workout.started_at,
        finished_at=workout.finished_at,
        points=workout.points or 0,
        volume_kg=workout.volume_kg or 0.0,
        effort_km=workout.effort_km or 0.0,
        photo_url=photo_url(workout.id, workout.photo_version),
        exercises=exercises,
        point_lines=[
            ExportPointLine(key=e.key, vars=e.vars, points=e.points) for e in item.point_lines
        ],
    )


def to_export_response(export: Export, catalog: Catalog) -> ExportResponse:
    """The whole file."""
    user = export.user
    return ExportResponse(
        exported_at=export.exported_at,
        account=ExportAccount(
            display_name=user.display_name,
            email=user.email,
            language=user.language,
            crew=export.crew.name if export.crew else None,
            created_at=user.created_at,
        ),
        gyms=[to_gym_model(g) for g in export.gyms],
        personal_records=[
            ExportRecord(
                exercise_id=r.exercise_id,
                load_kg=r.load_kg,
                bar_kg=r.bar_kg,
                reps=r.reps,
                e1rm=r.e1rm,
                achieved_at=r.achieved_at,
            )
            for r in export.records
        ],
        workouts=[_workout(item, catalog) for item in export.workouts],
    )
