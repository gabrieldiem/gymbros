"""Accounts and sessions: register, log in, log out, resolve the session cookie."""

from collections.abc import Callable
from datetime import datetime, timedelta

from db.repositories.session_repository import SessionRepository
from db.repositories.user_repository import UserRepository
from db.tables.user import User
from services.auth_types import LoggedIn, Registration
from services.crew_service import CrewService
from services.errors import EmailAlreadyRegistered, InvalidCredentials, NotAuthenticated
from services.password_hasher import PasswordHasher
from services.profile_rules import COLORS, derive_initials
from services.session_tokens import SessionTokens


class AuthService:
    # pylint: disable=too-many-arguments,too-many-positional-arguments
    """Owns passwords and sessions. Never sees HTTP; the route sets the cookie."""

    def __init__(
        self,
        users: UserRepository,
        sessions: SessionRepository,
        crews: CrewService,
        hasher: PasswordHasher,
        tokens: SessionTokens,
        session_ttl: timedelta,
        now: Callable[[], datetime],
    ) -> None:
        self._users = users
        self._sessions = sessions
        self._crews = crews
        self._hasher = hasher
        self._tokens = tokens
        self._session_ttl = session_ttl
        self._now = now
        self._dummy_hash: str | None = None

    async def register(self, registration: Registration) -> LoggedIn:
        """Create the account (and join the crew if a code is given), then log in."""
        crew = None
        if registration.invite_code:
            crew = await self._crews.find_by_code(registration.invite_code)
        email = registration.email.lower()
        if await self._users.get_by_email(email) is not None:
            raise EmailAlreadyRegistered(email)
        user = await self._users.add(await self._new_user(registration, email))
        if crew is not None:
            await self._crews.join(user, crew)
        return await self._start_session(user)

    async def _new_user(self, registration: Registration, email: str) -> User:
        return User(
            email=email,
            password_hash=await self._hasher.hash(registration.password),
            display_name=registration.display_name.strip(),
            initials=derive_initials(registration.display_name),
            color=COLORS[0],
            language=registration.language,
            rest_seconds=90,
        )

    async def log_in(self, email: str, password: str) -> LoggedIn:
        """Check the password and open a session. Unknown emails cost the same as wrong ones."""
        user = await self._users.get_by_email(email.lower())
        if user is None:
            await self._hasher.verify(await self._get_dummy_hash(), password)
            raise InvalidCredentials()
        if not await self._hasher.verify(user.password_hash, password):
            raise InvalidCredentials()
        return await self._start_session(user)

    async def log_out(self, token: str | None) -> None:
        """End the session, if there is one."""
        if token:
            await self._sessions.delete(self._tokens.hash(token))

    async def authenticate(self, token: str | None) -> User:
        """The user behind a session token, or NotAuthenticated."""
        if not token:
            raise NotAuthenticated()
        user_id = await self._sessions.get_user_id(self._tokens.hash(token), self._now())
        user = await self._users.get(user_id) if user_id else None
        if user is None:
            raise NotAuthenticated()
        return user

    async def _start_session(self, user: User) -> LoggedIn:
        # Logins are rare and the table is small, so this is where expired rows get cleaned up.
        await self._sessions.delete_expired(self._now())
        token = self._tokens.new_token()
        expires_at = self._now() + self._session_ttl
        await self._sessions.add(self._tokens.hash(token), user.id, expires_at)
        return LoggedIn(user=user, token=token)

    async def _get_dummy_hash(self) -> str:
        if self._dummy_hash is None:
            self._dummy_hash = await self._hasher.hash("timing-equalizer")
        return self._dummy_hash
