"""A user together with the crew they belong to."""

from dataclasses import dataclass

from db.tables.crew import Crew
from db.tables.user import User


@dataclass(frozen=True, slots=True)
class Member:
    """The signed-in member. Crew-scoped routes depend on this, not on User."""

    user: User
    crew: Crew
