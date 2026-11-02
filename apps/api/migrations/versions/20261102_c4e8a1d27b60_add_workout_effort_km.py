"""add workout effort km

Revision ID: c4e8a1d27b60
Revises: b7d2f4a91c3e
Create Date: 2026-11-02 12:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4e8a1d27b60"
down_revision: Union[str, Sequence[str], None] = "b7d2f4a91c3e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("workouts", sa.Column("effort_km", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("workouts", "effort_km")
