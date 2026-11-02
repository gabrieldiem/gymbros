"""add bar_kg

Revision ID: b8d5f2a19c43
Revises: a7c4e1f08b32
Create Date: 2026-11-06 12:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8d5f2a19c43"
down_revision: Union[str, Sequence[str], None] = "a7c4e1f08b32"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("workout_sets", sa.Column("bar_kg", sa.Float(), nullable=True))
    op.add_column("personal_records", sa.Column("bar_kg", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("personal_records", "bar_kg")
    op.drop_column("workout_sets", "bar_kg")
