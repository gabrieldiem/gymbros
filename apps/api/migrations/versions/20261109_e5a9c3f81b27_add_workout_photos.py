"""add workout photos

Revision ID: e5a9c3f81b27
Revises: d4f8b1e72a06
Create Date: 2026-11-09 12:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5a9c3f81b27"
down_revision: Union[str, Sequence[str], None] = "d4f8b1e72a06"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workout_photos",
        sa.Column("workout_id", sa.Uuid(), nullable=False),
        sa.Column("image", sa.LargeBinary(), nullable=False),
        sa.Column("content_type", sa.String(length=32), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workout_id"], ["workouts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("workout_id"),
    )
    op.add_column("workouts", sa.Column("photo_version", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("workouts", "photo_version")
    op.drop_table("workout_photos")
