"""add step entries

Revision ID: e5a2c9f37b80
Revises: d4f1b8e26a79
"""

import sqlalchemy as sa
from alembic import op

revision = "e5a2c9f37b80"
down_revision = "d4f1b8e26a79"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """A new table and a nullable column, so the previous version keeps working on a rollback."""
    op.create_table(
        "step_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "crew_id", sa.Uuid(), sa.ForeignKey("crews.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("steps", sa.Integer(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_step_entries_user_id_start_date", "step_entries", ["user_id", "start_date"])
    op.create_index("ix_step_entries_crew_id", "step_entries", ["crew_id"])
    op.add_column(
        "point_events",
        sa.Column(
            "step_entry_id",
            sa.Uuid(),
            sa.ForeignKey("step_entries.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_point_events_step_entry_id", "point_events", ["step_entry_id"])


def downgrade() -> None:
    """Remove them, with the points they paid."""
    op.execute("DELETE FROM point_events WHERE step_entry_id IS NOT NULL")
    op.drop_index("ix_point_events_step_entry_id", table_name="point_events")
    op.drop_column("point_events", "step_entry_id")
    op.drop_table("step_entries")
