"""Resend's HTTP API: https://resend.com/docs/api-reference/emails/send-email."""

import re
from collections.abc import Sequence
from logging import Logger
from typing import Any

import httpx

from services.welcome_email import EmailMessage

SEND_URL = "https://api.resend.com/emails"
BATCH_URL = "https://api.resend.com/emails/batch"
_BATCH_SIZE = 100
_TIMEOUT_SECONDS = 10
_EMAIL_ADDRESS = re.compile(r"\S+@\S+")


def _rejection(response: httpx.Response) -> str:
    """What Resend said, which is what tells a bad key from an unverified domain. Addresses are
    masked, so a member's email never reaches the logs."""
    try:
        body = response.json()
    except ValueError:
        return "no details"
    if not isinstance(body, dict):
        return "no details"
    return _EMAIL_ADDRESS.sub("<address>", f"{body.get('name')}: {body.get('message')}")


class ResendEmailClient:
    """Implements EmailSender. Without an API key it only logs that it skipped the message."""

    def __init__(
        self,
        api_key: str,
        sender: str,
        logger: Logger,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._sender = sender
        self._logger = logger
        self._transport = transport

    def _payload(self, message: EmailMessage) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "from": self._sender,
            "to": [message.to],
            "subject": message.subject,
            "html": message.html,
            "text": message.text,
        }
        if message.headers:
            payload["headers"] = dict(message.headers)
        return payload

    async def _post(self, url: str, body: Any) -> bool:
        try:
            async with httpx.AsyncClient(
                transport=self._transport, timeout=_TIMEOUT_SECONDS
            ) as client:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "User-Agent": "gymbros-api",
                    },
                    json=body,
                )
        except httpx.HTTPError as error:
            self._logger.warning("Sending email failed: %s", type(error).__name__)
            return False
        if response.is_error:
            self._logger.warning(
                "Sending email failed: HTTP %d, %s", response.status_code, _rejection(response)
            )
            return False
        return True

    async def send(self, message: EmailMessage) -> bool:
        """Send the message and say if it went out. Failures are logged without the recipient or
        the key."""
        if not self._api_key:
            self._logger.info("RESEND_API_KEY is not set; skipped email %r", message.subject)
            return False
        return await self._post(SEND_URL, self._payload(message))

    async def send_many(self, messages: Sequence[EmailMessage]) -> int:
        """Send several in batches, each one addressed to one person. Says how many went out."""
        if not self._api_key:
            self._logger.info("RESEND_API_KEY is not set; skipped %d emails", len(messages))
            return 0
        sent = 0
        for start in range(0, len(messages), _BATCH_SIZE):
            batch = messages[start : start + _BATCH_SIZE]
            if await self._post(BATCH_URL, [self._payload(m) for m in batch]):
                sent += len(batch)
        return sent
