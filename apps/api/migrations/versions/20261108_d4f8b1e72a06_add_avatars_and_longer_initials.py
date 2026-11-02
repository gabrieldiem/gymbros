"""add avatars and longer initials

Revision ID: d4f8b1e72a06
Revises: c2e7a9d40f15
Create Date: 2026-11-08 12:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4f8b1e72a06"
down_revision: Union[str, Sequence[str], None] = "c2e7a9d40f15"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "avatars",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("image", sa.LargeBinary(), nullable=False),
        sa.Column("content_type", sa.String(length=32), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.add_column("users", sa.Column("avatar_version", sa.Integer(), nullable=True))
    # Widening is safe for a rollback: the previous version only ever writes two characters.
    op.alter_column("users", "initials", type_=sa.String(length=32))


def downgrade() -> None:
    op.execute("UPDATE users SET initials = left(initials, 2)")
    op.alter_column("users", "initials", type_=sa.String(length=2))
    op.drop_column("users", "avatar_version")
    op.drop_table("avatars")
