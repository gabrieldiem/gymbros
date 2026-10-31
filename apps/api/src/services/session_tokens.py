"""Opaque session tokens. The cookie carries the token; the database stores only its HMAC."""

import hashlib
import hmac
import secrets


class SessionTokens:
    """Create tokens and derive the hash stored in `auth_sessions`."""

    def __init__(self, secret: str) -> None:
        self._key = secret.encode()

    @staticmethod
    def new_token() -> str:
        """256 bits of randomness, URL-safe."""
        return secrets.token_urlsafe(32)

    def hash(self, token: str) -> str:
        """HMAC-SHA256 so a leaked table can't be replayed without the secret."""
        return hmac.new(self._key, token.encode(), hashlib.sha256).hexdigest()
