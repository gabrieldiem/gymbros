"""add workout performed_on

Revision ID: f3b9d2c6a1e4
Revises: e2a7b84c19d3
Create Date: 2026-11-04 12:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3b9d2c6a1e4"
down_revision: Union[str, Sequence[str], None] = "e2a7b84c19d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("workouts", sa.Column("performed_on", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("workouts", "performed_on")
