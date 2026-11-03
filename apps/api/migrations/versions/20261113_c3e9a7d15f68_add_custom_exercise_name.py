"""add custom exercise name

Revision ID: c3e9a7d15f68
Revises: b2d8f6c04e57
"""

import sqlalchemy as sa
from alembic import op

revision = "c3e9a7d15f68"
down_revision = "b2d8f6c04e57"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Nullable, so the previous version keeps working if a deploy rolls back."""
    op.add_column("workout_sets", sa.Column("custom_name", sa.String(60), nullable=True))


def downgrade() -> None:
    """Remove the column."""
    op.drop_column("workout_sets", "custom_name")
