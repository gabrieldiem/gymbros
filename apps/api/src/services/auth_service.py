"""Accounts and sessions: Google sign-in, dev login, log out, resolve the session cookie."""

from collections.abc import Callable
from datetime import datetime, timedelta

from db.repositories.session_repository import SessionRepository
from db.repositories.user_repository import UserRepository
from db.tables.user import User
from services.auth_types import DevLogin, LoggedIn
from services.crew_service import CrewService
from services.errors import GoogleSignInFailed, NotAuthenticated
from services.google_identity import GoogleIdentity
from services.profile_rules import COLORS, derive_initials
from services.session_tokens import SessionTokens

_MAX_NAME = 24


class AuthService:
    """Owns accounts and sessions. Never sees HTTP; the route sets the cookie."""

    def __init__(
        self,
        users: UserRepository,
        sessions: SessionRepository,
        crews: CrewService,
        tokens: SessionTokens,
        session_ttl: timedelta,
        now: Callable[[], datetime],
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._users = users
        self._sessions = sessions
        self._crews = crews
        self._tokens = tokens
        self._session_ttl = session_ttl
        self._now = now

    async def sign_in_with_google(self, identity: GoogleIdentity, language: str) -> LoggedIn:
        """Find the account by Google id, else link one by verified email, else create one."""
        user = await self._users.get_by_google_sub(identity.sub)
        if user is not None:
            return await self._start_session(user)
        user = await self._users.get_by_email(identity.email)
        if user is not None:
            # A different Google account now owns this address: never hand it the old account.
            if user.google_sub is not None:
                raise GoogleSignInFailed("the email is linked to another Google account")
            user.google_sub = identity.sub
            return await self._start_session(await self._users.save(user))
        user = await self._add_user(identity.email, identity.display_name, language, identity.sub)
        return await self._start_session(user, created=True)

    async def dev_log_in(self, login: DevLogin) -> LoggedIn:
        """Sign in by email alone, creating the account. The route only allows this outside prod."""
        crew = await self._crews.find_by_code(login.invite_code) if login.invite_code else None
        email = login.email.lower()
        user = await self._users.get_by_email(email)
        if user is not None:
            return await self._start_session(user)
        user = await self._add_user(
            email, login.display_name or email.split("@")[0].title(), login.language
        )
        if crew is not None:
            await self._crews.join(user, crew)
        return await self._start_session(user, created=True)

    async def _add_user(
        self, email: str, display_name: str, language: str, google_sub: str | None = None
    ) -> User:
        name = display_name.strip()[:_MAX_NAME].strip()
        return await self._users.add(
            User(
                email=email,
                google_sub=google_sub,
                display_name=name,
                initials=derive_initials(name),
                color=COLORS[0],
                language=language,
                rest_seconds=90,
            )
        )

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

    async def _start_session(self, user: User, created: bool = False) -> LoggedIn:
        # Logins are rare and the table is small, so this is where expired rows get cleaned up.
        await self._sessions.delete_expired(self._now())
        token = self._tokens.new_token()
        expires_at = self._now() + self._session_ttl
        await self._sessions.add(self._tokens.hash(token), user.id, expires_at)
        return LoggedIn(user=user, token=token, created=created)
