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
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(24))
    initials: Mapped[str] = mapped_column(String(2))
    color: Mapped[str] = mapped_column(String(16))
    language: Mapped[str] = mapped_column(String(2))
    rest_seconds: Mapped[int] = mapped_column(Integer, default=90, server_default="90")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
