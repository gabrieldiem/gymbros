"""post steps to the feed

Revision ID: f6b3d0a48c91
Revises: e5a2c9f37b80
"""

import sqlalchemy as sa
from alembic import op

revision = "f6b3d0a48c91"
down_revision = "e5a2c9f37b80"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """A nullable column, so the previous version keeps working on a rollback. Steps logged before
    this get their post too, dated when they were logged, so the feed has no gap."""
    op.add_column(
        "feed_items",
        sa.Column(
            "step_entry_id",
            sa.Uuid(),
            sa.ForeignKey("step_entries.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_feed_items_step_entry_id", "feed_items", ["step_entry_id"])
    op.execute("""
        INSERT INTO feed_items (id, crew_id, actor_id, kind, step_entry_id, vars, created_at)
        SELECT
            gen_random_uuid(), crew_id, user_id, 'steps', id,
            jsonb_build_object(
                'steps', steps,
                'points', points,
                'days', end_date - start_date + 1,
                'start_date', start_date,
                'end_date', end_date
            ),
            created_at
        FROM step_entries
        """)


def downgrade() -> None:
    """Take the posts down, with what was said under them, and the column."""
    op.execute("DELETE FROM feed_items WHERE step_entry_id IS NOT NULL")
    op.drop_index("ix_feed_items_step_entry_id", table_name="feed_items")
    op.drop_column("feed_items", "step_entry_id")
