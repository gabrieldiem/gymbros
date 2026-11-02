"""email_settings: what the backoffice decides about email. One row, created when first read."""

from sqlalchemy import Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base

SETTINGS_ID = 1


class EmailSettings(Base):  # pylint: disable=too-few-public-methods
    """The weekly digest starts off: nobody gets it until an admin turns it on."""

    __tablename__ = "email_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=SETTINGS_ID)
    welcome_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    digest_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    # The hour on Monday morning it goes out, in each crew's time zone.
    digest_hour: Mapped[int] = mapped_column(Integer, default=9)
