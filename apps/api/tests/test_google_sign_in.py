"""Google sign-in: the one-time OAuth attempt, ID token checks and the token exchange."""

import base64
import json
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from clients.google_oauth_client import GoogleOAuthClient
from services.errors import GoogleSignInFailed
from services.google_identity import parse_id_token
from services.oauth_attempt import OAuthAttempt

NOW = datetime(2026, 11, 2, 9, 0, tzinfo=UTC)
CLIENT_ID = "client-id"
GOOD_CLAIMS = {
    "iss": "https://accounts.google.com",
    "aud": CLIENT_ID,
    "exp": NOW.timestamp() + 300,
    "nonce": "the-nonce",
    "sub": "google-123",
    "email": "Gabi@Example.com",
    "email_verified": True,
    "given_name": "Gabi",
    "name": "Gabi Diem",
}


def _token(**overrides) -> str:
    claims = {**GOOD_CLAIMS, **overrides}
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    return f"header.{payload}.signature"


def _parse(token: str):
    return parse_id_token(token, CLIENT_ID, "the-nonce", NOW)


def test_a_good_token_gives_the_identity_with_a_lowercase_email():
    identity = _parse(_token())
    assert identity.sub == "google-123"
    assert identity.email == "gabi@example.com"
    assert identity.display_name == "Gabi"


def test_the_short_issuer_form_is_accepted():
    assert _parse(_token(iss="accounts.google.com")).sub == "google-123"


def test_the_display_name_falls_back_to_the_name_then_the_email():
    assert _parse(_token(given_name=None)).display_name == "Gabi Diem"
    assert _parse(_token(given_name=None, name=None)).display_name == "gabi"


@pytest.mark.parametrize(
    "overrides",
    [
        {"iss": "https://evil.example.com"},
        {"aud": "another-client"},
        {"exp": NOW.timestamp() - 1},
        {"nonce": "replayed-nonce"},
        {"email_verified": False},
        {"email_verified": "true"},
        {"sub": ""},
        {"email": None},
    ],
)
def test_a_token_failing_any_check_is_rejected(overrides):
    with pytest.raises(GoogleSignInFailed):
        _parse(_token(**overrides))


@pytest.mark.parametrize("token", ["", "not-a-jwt", "a.b", "a.!!!.c", "a.bm90LWpzb24.c"])
def test_a_malformed_token_is_rejected(token):
    with pytest.raises(GoogleSignInFailed):
        _parse(token)


def test_an_attempt_survives_the_cookie_round_trip():
    attempt = OAuthAttempt.new("es")
    assert OAuthAttempt.from_cookie(attempt.to_cookie()) == attempt


def test_each_attempt_is_different():
    assert OAuthAttempt.new("en").state != OAuthAttempt.new("en").state


def test_an_unknown_language_falls_back_to_english():
    assert OAuthAttempt.new("fr").language == "en"
    tampered = OAuthAttempt.new("en").to_cookie().rsplit(".", 1)[0] + ".xx"
    assert OAuthAttempt.from_cookie(tampered).language == "en"


@pytest.mark.parametrize("cookie", [None, "", "a.b", "a.b.c.d.e"])
def test_a_missing_or_broken_cookie_is_rejected(cookie):
    with pytest.raises(GoogleSignInFailed):
        OAuthAttempt.from_cookie(cookie)


def test_only_the_same_state_matches():
    attempt = OAuthAttempt.new("en")
    attempt.check_state(attempt.state)
    for wrong in ("other", "", None):
        with pytest.raises(GoogleSignInFailed):
            attempt.check_state(wrong)


def test_the_challenge_is_the_s256_of_the_verifier():
    # The example from RFC 7636, appendix B.
    attempt = OAuthAttempt("s", "n", "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", "en")
    assert attempt.code_challenge() == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"


def _client(handler) -> GoogleOAuthClient:
    return GoogleOAuthClient(
        CLIENT_ID,
        "client-secret",
        "https://app.example.com/api/auth/google/callback",
        lambda: NOW,
        httpx.MockTransport(handler),
    )


def test_the_authorization_url_carries_the_attempt():
    attempt = OAuthAttempt.new("es")
    url = urlparse(_client(lambda _: httpx.Response(500)).authorization_url(attempt))
    query = {key: values[0] for key, values in parse_qs(url.query).items()}
    assert url.netloc == "accounts.google.com"
    assert query["client_id"] == CLIENT_ID
    assert query["redirect_uri"] == "https://app.example.com/api/auth/google/callback"
    assert query["response_type"] == "code"
    assert query["scope"] == "openid email profile"
    assert query["state"] == attempt.state
    assert query["nonce"] == attempt.nonce
    assert query["code_challenge"] == attempt.code_challenge()
    assert query["code_challenge_method"] == "S256"
    assert query["hl"] == "es"
    assert "client-secret" not in url.query


async def test_exchanging_a_code_returns_the_identity():
    attempt = OAuthAttempt("state", "the-nonce", "the-verifier", "en")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update({k: v[0] for k, v in parse_qs(request.content.decode()).items()})
        return httpx.Response(200, json={"id_token": _token()})

    identity = await _client(handler).identify("the-code", attempt)
    assert identity.sub == "google-123"
    assert seen["code"] == "the-code"
    assert seen["code_verifier"] == "the-verifier"
    assert seen["client_secret"] == "client-secret"
    assert seen["grant_type"] == "authorization_code"


@pytest.mark.parametrize(
    "response",
    [httpx.Response(400, json={"error": "invalid_grant"}), httpx.Response(200, json={})],
)
async def test_a_failed_exchange_is_rejected(response):
    attempt = OAuthAttempt("state", "the-nonce", "the-verifier", "en")
    with pytest.raises(GoogleSignInFailed):
        await _client(lambda _: response).identify("the-code", attempt)


async def test_a_network_error_is_rejected():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    attempt = OAuthAttempt("state", "the-nonce", "the-verifier", "en")
    with pytest.raises(GoogleSignInFailed):
        await _client(handler).identify("the-code", attempt)
