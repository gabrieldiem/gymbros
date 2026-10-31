"""crews: the group of friends that climbs together."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Crew(Base):  # pylint: disable=too-few-public-methods
    """A crew. Weeks are computed in its IANA `time_zone`."""

    __tablename__ = "crews"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(40))
    time_zone: Mapped[str] = mapped_column(String(64))
    invite_code: Mapped[str] = mapped_column(String(12), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
