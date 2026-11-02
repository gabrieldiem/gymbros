"""add user whats_new_seen

Revision ID: a7c4e1f08b32
Revises: f3b9d2c6a1e4
Create Date: 2026-11-05 12:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7c4e1f08b32"
down_revision: Union[str, Sequence[str], None] = "f3b9d2c6a1e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("whats_new_seen", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "whats_new_seen")
