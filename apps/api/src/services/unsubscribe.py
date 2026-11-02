"""Unsubscribe links: signed, so one can't be made for someone else, and needing no sign-in."""

import hashlib
import hmac
import uuid
from urllib.parse import urlencode


def unsubscribe_token(user_id: uuid.UUID, secret: str) -> str:
    """The signature that goes in this member's links."""
    message = f"unsubscribe:{user_id}".encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def token_is_valid(user_id: uuid.UUID, token: str, secret: str) -> bool:
    """Whether the link is really this member's."""
    return hmac.compare_digest(unsubscribe_token(user_id, secret), token)


def unsubscribe_query(user_id: uuid.UUID, secret: str) -> str:
    """What identifies the member in a link."""
    return urlencode({"u": str(user_id), "t": unsubscribe_token(user_id, secret)})
