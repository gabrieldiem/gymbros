"""Who Google says signed in, read from the ID token."""

import base64
import binascii
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from services.errors import GoogleSignInFailed
from services.oauth_attempt import OAuthAttempt

_ISSUERS = ("https://accounts.google.com", "accounts.google.com")


@dataclass(frozen=True, slots=True)
class GoogleIdentity:
    """A verified Google account. `sub` is its permanent id; the email can change."""

    sub: str
    email: str
    display_name: str


class GoogleSignIn(Protocol):
    """The Google side of signing in."""

    def authorization_url(self, attempt: OAuthAttempt) -> str:
        """Where to send the browser to pick an account."""

    async def identify(self, code: str, attempt: OAuthAttempt) -> GoogleIdentity:
        """Exchange the callback's code for the identity. Raises GoogleSignInFailed."""


def _decode_claims(id_token: str) -> dict[str, Any]:
    parts = id_token.split(".")
    if len(parts) != 3:
        raise GoogleSignInFailed("the ID token is not a JWT")
    try:
        padded = parts[1] + "=" * (-len(parts[1]) % 4)
        claims = json.loads(base64.urlsafe_b64decode(padded))
    except (binascii.Error, ValueError) as error:
        raise GoogleSignInFailed("the ID token payload is unreadable") from error
    if not isinstance(claims, dict):
        raise GoogleSignInFailed("the ID token payload is not an object")
    return claims


def parse_id_token(id_token: str, client_id: str, nonce: str, now: datetime) -> GoogleIdentity:
    """Check the claims and return the identity.

    The signature isn't checked: this token comes straight from Google's token endpoint over TLS,
    authenticated with the client secret, which OpenID Connect Core 3.1.3.7 allows. Never pass this
    a token that came through a browser.
    """
    claims = _decode_claims(id_token)
    if claims.get("iss") not in _ISSUERS or claims.get("aud") != client_id:
        raise GoogleSignInFailed("wrong issuer or audience")
    if not isinstance(claims.get("exp"), (int, float)) or claims["exp"] <= now.timestamp():
        raise GoogleSignInFailed("the ID token expired")
    if claims.get("nonce") != nonce:
        raise GoogleSignInFailed("nonce mismatch")
    # Linking accounts by email is only safe when Google vouches for that email.
    if claims.get("email_verified") is not True:
        raise GoogleSignInFailed("the email isn't verified")
    sub, email = claims.get("sub"), claims.get("email")
    if not sub or not email:
        raise GoogleSignInFailed("the ID token has no subject or email")
    email = email.lower()
    name = claims.get("given_name") or claims.get("name") or email.split("@")[0]
    return GoogleIdentity(sub, email, name)
