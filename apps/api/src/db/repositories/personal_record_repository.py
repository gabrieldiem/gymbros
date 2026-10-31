"""SQL for personal records."""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from db.tables.personal_record import PersonalRecord
from services.scoring_types import RecordSet


class PersonalRecordRepository:
    """Reads and writes `personal_records`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def best_e1rm_by_exercise(self, user_id: uuid.UUID) -> dict[str, float]:
        """The stored PR e1RM for every exercise the user has logged."""
        result = await self._session.execute(
            select(PersonalRecord.exercise_id, PersonalRecord.e1rm).where(
                PersonalRecord.user_id == user_id
            )
        )
        return dict(result.all())

    async def store(
        self, user_id: uuid.UUID, record: RecordSet, workout_id: uuid.UUID, at: datetime
    ) -> None:
        """Insert or replace the PR for this exercise."""
        values = {
            "user_id": user_id,
            "exercise_id": record.exercise_id,
            "load_kg": record.load_kg,
            "reps": record.reps,
            "e1rm": record.e1rm,
            "workout_id": workout_id,
            "achieved_at": at,
        }
        statement = insert(PersonalRecord).values(**values)
        await self._session.execute(
            statement.on_conflict_do_update(index_elements=["user_id", "exercise_id"], set_=values)
        )
