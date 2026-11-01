"""Resend's HTTP API: https://resend.com/docs/api-reference/emails/send-email."""

from logging import Logger

import httpx

from services.welcome_email import EmailMessage

SEND_URL = "https://api.resend.com/emails"
_TIMEOUT_SECONDS = 10


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

    async def send(self, message: EmailMessage) -> None:
        """Send the message. Failures are logged without the recipient or the key."""
        if not self._api_key:
            self._logger.info("RESEND_API_KEY is not set; skipped email %r", message.subject)
            return
        try:
            async with httpx.AsyncClient(
                transport=self._transport, timeout=_TIMEOUT_SECONDS
            ) as client:
                response = await client.post(
                    SEND_URL,
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "User-Agent": "gymbros-api",
                    },
                    json={
                        "from": self._sender,
                        "to": [message.to],
                        "subject": message.subject,
                        "html": message.html,
                        "text": message.text,
                    },
                )
            response.raise_for_status()
        except httpx.HTTPError as error:
            self._logger.warning("Sending email failed: %s", type(error).__name__)
