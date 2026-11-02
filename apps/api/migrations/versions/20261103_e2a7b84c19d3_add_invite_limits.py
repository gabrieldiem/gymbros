"""add invite limits

Revision ID: e2a7b84c19d3
Revises: d9f1c3e65a07
Create Date: 2026-11-03 12:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2a7b84c19d3"
down_revision: Union[str, Sequence[str], None] = "d9f1c3e65a07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "crews", sa.Column("invite_uses", sa.Integer(), server_default="0", nullable=False)
    )
    op.add_column("crews", sa.Column("invite_max_uses", sa.Integer(), nullable=True))
    op.add_column(
        "crews", sa.Column("invite_expires_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("crews", "invite_expires_at")
    op.drop_column("crews", "invite_max_uses")
    op.drop_column("crews", "invite_uses")
