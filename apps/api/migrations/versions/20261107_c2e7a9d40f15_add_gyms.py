"""add gyms

Revision ID: c2e7a9d40f15
Revises: b8d5f2a19c43
Create Date: 2026-11-07 12:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c2e7a9d40f15"
down_revision: Union[str, Sequence[str], None] = "b8d5f2a19c43"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gyms",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_gyms_user_id_name", "gyms", ["user_id", sa.text("lower(name)")], unique=True
    )
    op.create_index(
        "uq_gyms_user_id_default",
        "gyms",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )
    op.add_column("workouts", sa.Column("gym_name", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("workouts", "gym_name")
    op.drop_index("uq_gyms_user_id_default", table_name="gyms")
    op.drop_index("uq_gyms_user_id_name", table_name="gyms")
    op.drop_table("gyms")
