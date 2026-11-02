"""users: one account per person. Email is stored lower-cased."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class User(Base):  # pylint: disable=too-few-public-methods
    """A GYMBROS account."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    # Unused since Google sign-in; a later migration drops it.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True)
    display_name: Mapped[str] = mapped_column(String(24))
    # Shown when there's no picture: up to two characters, which can be emoji (see avatar_text).
    initials: Mapped[str] = mapped_column(String(32))
    # Changes with each uploaded picture, so a browser never shows an old one. Null: no picture.
    avatar_version: Mapped[int | None] = mapped_column(Integer)
    color: Mapped[str] = mapped_column(String(16))
    language: Mapped[str] = mapped_column(String(2))
    rest_seconds: Mapped[int] = mapped_column(Integer, default=90, server_default="90")
    # The newest what's new entry this account was told about.
    whats_new_seen: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
