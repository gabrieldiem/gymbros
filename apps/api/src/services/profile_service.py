"""The signed-in user's profile: read it with its crew, change name, color or language."""

from dataclasses import dataclass

from db.repositories.crew_repository import CrewRepository
from db.repositories.user_repository import UserRepository
from db.tables.crew import Crew
from db.tables.user import User
from services.avatar_text import clean_avatar_text
from services.errors import DeleteNotConfirmed
from services.profile_rules import derive_initials


@dataclass(frozen=True, slots=True)
class Profile:
    """A user and the crew they belong to (None until they join one)."""

    user: User
    crew: Crew | None
    is_admin: bool = False


@dataclass(frozen=True, slots=True)
class ProfileChanges:
    """Fields the user may change. None means unchanged."""

    display_name: str | None = None
    initials: str | None = None
    color: str | None = None
    language: str | None = None
    rest_seconds: int | None = None
    email_updates: bool | None = None


class ProfileService:
    """Reads and updates profiles."""

    def __init__(
        self,
        users: UserRepository,
        crews: CrewRepository,
        admin_emails: frozenset[str] = frozenset(),
    ) -> None:
        self._users = users
        self._crews = crews
        self._admin_emails = admin_emails

    async def get(self, user: User) -> Profile:
        """The user with their crew."""
        return Profile(
            user=user,
            crew=await self._crews.get_crew_of(user.id),
            is_admin=user.email.lower() in self._admin_emails,
        )

    async def delete(self, user: User, confirm_email: str) -> None:
        """Delete the account and everything in it, once its email has been typed to confirm."""
        if confirm_email.strip().lower() != user.email.lower():
            raise DeleteNotConfirmed(str(user.id))
        await self._users.delete(user)

    async def update(self, user: User, changes: ProfileChanges) -> Profile:
        """Apply the changes. A new name changes your characters only if you never chose any."""
        if changes.display_name is not None:
            derived = user.initials == derive_initials(user.display_name)
            user.display_name = changes.display_name.strip()
            if derived:
                user.initials = derive_initials(user.display_name)
        if changes.initials is not None:
            user.initials = clean_avatar_text(changes.initials)
        if changes.color is not None:
            user.color = changes.color.lower()
        if changes.language is not None:
            user.language = changes.language
        if changes.rest_seconds is not None:
            user.rest_seconds = changes.rest_seconds
        if changes.email_updates is not None:
            user.email_updates = changes.email_updates
        await self._users.save(user)
        return await self.get(user)
