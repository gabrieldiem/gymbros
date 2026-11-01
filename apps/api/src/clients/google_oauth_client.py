"""Google's OAuth endpoints: the account picker and the token exchange."""

from collections.abc import Callable
from datetime import datetime
from urllib.parse import urlencode

import httpx

from services.errors import GoogleSignInFailed
from services.google_identity import GoogleIdentity, parse_id_token
from services.oauth_attempt import OAuthAttempt

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
_TIMEOUT_SECONDS = 10


class GoogleOAuthClient:
    """Implements GoogleSignIn over HTTP. `transport` lets tests replace the network."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        now: Callable[[], datetime],
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        # pylint: disable=too-many-arguments,too-many-positional-arguments
        self._client_id = client_id
        self._client_secret = client_secret
        self._redirect_uri = redirect_uri
        self._now = now
        self._transport = transport

    def authorization_url(self, attempt: OAuthAttempt) -> str:
        """Google's account picker for this attempt."""
        query = {
            "client_id": self._client_id,
            "redirect_uri": self._redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": attempt.state,
            "nonce": attempt.nonce,
            "code_challenge": attempt.code_challenge(),
            "code_challenge_method": "S256",
            "prompt": "select_account",
            "hl": attempt.language,
        }
        return f"{AUTHORIZE_URL}?{urlencode(query)}"

    async def identify(self, code: str, attempt: OAuthAttempt) -> GoogleIdentity:
        """Exchange the code for tokens and read the identity from the ID token."""
        id_token = await self._fetch_id_token(code, attempt.verifier)
        return parse_id_token(id_token, self._client_id, attempt.nonce, self._now())

    async def _fetch_id_token(self, code: str, verifier: str) -> str:
        form = {
            "code": code,
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "redirect_uri": self._redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": verifier,
        }
        try:
            async with httpx.AsyncClient(
                transport=self._transport, timeout=_TIMEOUT_SECONDS
            ) as client:
                response = await client.post(TOKEN_URL, data=form)
            response.raise_for_status()
            return str(response.json()["id_token"])
        except (httpx.HTTPError, KeyError, ValueError) as error:
            # Only the type: the message could carry the request's URL or form values.
            raise GoogleSignInFailed(f"token exchange failed: {type(error).__name__}") from error
