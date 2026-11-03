"""add gym locations

Revision ID: b2d8f6c04e57
Revises: a1c7e5b93d46
Create Date: 2026-11-12 12:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2d8f6c04e57"
down_revision: Union[str, Sequence[str], None] = "a1c7e5b93d46"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("gyms", sa.Column("lat", sa.Float(), nullable=True))
    op.add_column("gyms", sa.Column("lon", sa.Float(), nullable=True))
    op.add_column("gyms", sa.Column("address", sa.String(length=200), nullable=True))
    op.add_column("workouts", sa.Column("gym_lat", sa.Float(), nullable=True))
    op.add_column("workouts", sa.Column("gym_lon", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("workouts", "gym_lon")
    op.drop_column("workouts", "gym_lat")
    op.drop_column("gyms", "address")
    op.drop_column("gyms", "lon")
    op.drop_column("gyms", "lat")
