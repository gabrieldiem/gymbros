"""Every table module, imported here so Base.metadata is complete for Alembic."""

from db.tables.auth_session import AuthSession
from db.tables.crew import Crew
from db.tables.membership import Membership
from db.tables.user import User

__all__ = ["AuthSession", "Crew", "Membership", "User"]
