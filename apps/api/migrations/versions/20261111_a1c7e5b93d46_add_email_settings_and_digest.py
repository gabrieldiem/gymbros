"""add email settings and digest

Revision ID: a1c7e5b93d46
Revises: f6b0d4a92c38
Create Date: 2026-11-11 12:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1c7e5b93d46"
down_revision: Union[str, Sequence[str], None] = "f6b0d4a92c38"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("welcome_enabled", sa.Boolean(), nullable=False),
        sa.Column("digest_enabled", sa.Boolean(), nullable=False),
        sa.Column("digest_hour", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "digest_sends",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "week_start"),
    )
    op.add_column(
        "users",
        sa.Column("email_updates", sa.Boolean(), server_default="true", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "email_updates")
    op.drop_table("digest_sends")
    op.drop_table("email_settings")
