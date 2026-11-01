"""One Google sign-in attempt: the secrets that tie the callback to the browser that started it."""

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from typing import Self

from services.errors import GoogleSignInFailed

_LANGUAGES = ("en", "es")


def _known_language(language: str) -> str:
    return language if language in _LANGUAGES else "en"


@dataclass(frozen=True, slots=True)
class OAuthAttempt:
    """`state` stops login CSRF, `nonce` stops token replay, `verifier` is the PKCE secret."""

    state: str
    nonce: str
    verifier: str
    language: str

    @classmethod
    def new(cls, language: str) -> Self:
        """Fresh secrets. The language is the one a brand-new account starts with."""
        return cls(
            secrets.token_urlsafe(32),
            secrets.token_urlsafe(32),
            secrets.token_urlsafe(48),
            _known_language(language),
        )

    def code_challenge(self) -> str:
        """The PKCE S256 challenge sent to Google."""
        digest = hashlib.sha256(self.verifier.encode()).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()

    def to_cookie(self) -> str:
        """Dot-joined: url-safe tokens never contain a dot."""
        return ".".join((self.state, self.nonce, self.verifier, self.language))

    @classmethod
    def from_cookie(cls, value: str | None) -> Self:
        """Read the cookie back. A missing or broken one fails the sign-in."""
        parts = (value or "").split(".")
        if len(parts) != 4 or not all(parts):
            raise GoogleSignInFailed("missing or malformed attempt cookie")
        return cls(parts[0], parts[1], parts[2], _known_language(parts[3]))

    def check_state(self, state: str | None) -> None:
        """The state Google sent back must be the one this browser started with."""
        if not state or not hmac.compare_digest(state, self.state):
            raise GoogleSignInFailed("state mismatch")
