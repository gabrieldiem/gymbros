"""add admin actions

Revision ID: d9f1c3e65a07
Revises: c4e8a1d27b60
Create Date: 2026-11-02 13:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d9f1c3e65a07"
down_revision: Union[str, Sequence[str], None] = "c4e8a1d27b60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admin_actions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("admin_id", sa.Uuid(), nullable=True),
        sa.Column("admin_email", sa.String(length=254), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("target", sa.String(length=64), nullable=False),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["admin_id"],
            ["users.id"],
            name=op.f("fk_admin_actions_admin_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_admin_actions")),
    )
    op.create_index("ix_admin_actions_created_at", "admin_actions", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_admin_actions_created_at", table_name="admin_actions")
    op.drop_table("admin_actions")
