"""add emoji reactions and comment photos, and clean stored images

Revision ID: d4f1b8e26a79
Revises: c3e9a7d15f68
"""

import io
import logging

import sqlalchemy as sa
from alembic import op
from PIL import Image, ImageOps

revision = "d4f1b8e26a79"
down_revision = "c3e9a7d15f68"
branch_labels = None
depends_on = None

LOGGER = logging.getLogger("alembic.runtime.migration")


def _without_metadata(data: bytes) -> bytes | None:
    """The same picture, from its pixels alone. Kept here, not imported: a migration must keep
    meaning what it meant when it first ran."""
    try:
        with Image.open(io.BytesIO(data), formats=("JPEG", "PNG", "WEBP")) as image:
            upright = ImageOps.exif_transpose(image)
            image_format = str(image.format)
            if upright.mode not in ("RGB", "RGBA", "L"):
                upright = upright.convert("RGBA" if "transparency" in upright.info else "RGB")
            pixels = Image.frombytes(upright.mode, upright.size, upright.tobytes())
    except (OSError, ValueError, SyntaxError):
        return None
    if image_format == "JPEG" and pixels.mode == "RGBA":
        pixels = pixels.convert("RGB")
    output = io.BytesIO()
    pixels.save(output, format=image_format, quality=90, optimize=True)
    return output.getvalue()


def _clean_stored(table: str, key: str) -> None:
    """Images from before the server cleaned them. One it can't read is left, and logged."""
    connection = op.get_bind()
    rows = connection.execute(sa.text(f"SELECT {key} AS id, image FROM {table}")).all()
    for row in rows:
        cleaned = _without_metadata(bytes(row.image))
        if cleaned is None:
            LOGGER.warning("Could not clean one image in %s", table)
            continue
        connection.execute(
            sa.text(f"UPDATE {table} SET image = :image WHERE {key} = :id"),
            {"image": cleaned, "id": row.id},
        )


def upgrade() -> None:
    """All new or wider, so the previous version keeps working if a deploy rolls back."""
    op.alter_column(
        "reactions",
        "kind",
        type_=sa.String(32),
        existing_type=sa.String(8),
        existing_nullable=False,
    )
    op.add_column("comments", sa.Column("photo_version", sa.Integer(), nullable=True))
    op.create_table(
        "comment_reactions",
        sa.Column(
            "comment_id",
            sa.Uuid(),
            sa.ForeignKey("comments.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("emoji", sa.String(32), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "comment_photos",
        sa.Column(
            "comment_id",
            sa.Uuid(),
            sa.ForeignKey("comments.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("image", sa.LargeBinary(), nullable=False),
        sa.Column("content_type", sa.String(32), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    _clean_stored("avatars", "user_id")
    _clean_stored("workout_photos", "workout_id")


def downgrade() -> None:
    """Remove what was added. Metadata that was cleaned stays gone."""
    op.drop_table("comment_photos")
    op.drop_table("comment_reactions")
    op.drop_column("comments", "photo_version")
    op.alter_column("reactions", "kind", type_=sa.String(8), existing_type=sa.String(32))
