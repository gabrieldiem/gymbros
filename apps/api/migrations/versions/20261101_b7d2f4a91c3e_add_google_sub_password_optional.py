"""add google sub, password optional

Accounts now sign in with Google. password_hash stays (nullable) for this release, so the change can
be rolled back; a later migration drops it.

Revision ID: b7d2f4a91c3e
Revises: e9c11a1a82b7
Create Date: 2026-11-01 12:00:00.000000+00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7d2f4a91c3e"
down_revision: Union[str, Sequence[str], None] = "e9c11a1a82b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_sub", sa.String(length=255), nullable=True))
    op.create_unique_constraint(op.f("uq_users_google_sub"), "users", ["google_sub"])
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    # Accounts created after the upgrade have no password; they can't log in with one after this.
    op.execute("UPDATE users SET password_hash = '' WHERE password_hash IS NULL")
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)
    op.drop_constraint(op.f("uq_users_google_sub"), "users", type_="unique")
    op.drop_column("users", "google_sub")
