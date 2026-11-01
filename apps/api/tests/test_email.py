"""The welcome email's copy and sending it through Resend."""

import json
import logging

import httpx

from clients.resend_client import SEND_URL, ResendEmailClient
from services.welcome_email import welcome_email

LOGGER = logging.getLogger("test-email")
MESSAGE = welcome_email("gabi@example.com", "Gabi", "en", "https://app.example.com")


def test_the_email_follows_the_member_language():
    assert welcome_email("a@b.co", "Gabi", "es", "https://x").subject.endswith("GYMBROS")
    assert "Hola Gabi" in welcome_email("a@b.co", "Gabi", "es", "https://x").text
    assert "Hi Gabi" in welcome_email("a@b.co", "Gabi", "en", "https://x").text
    assert "Hi Gabi" in welcome_email("a@b.co", "Gabi", "fr", "https://x").text


def test_the_email_links_to_the_app():
    assert "https://app.example.com" in MESSAGE.text
    assert 'href="https://app.example.com"' in MESSAGE.html


def test_a_name_cannot_inject_html():
    message = welcome_email("a@b.co", "<img src=x>", "en", "https://x")
    assert "<img" not in message.html
    assert "&lt;img" in message.html


def _client(handler, api_key="the-key") -> ResendEmailClient:
    return ResendEmailClient(
        api_key, "GYMBROS <hola@contact.example.com>", LOGGER, httpx.MockTransport(handler)
    )


async def test_sending_posts_to_resend():
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"id": "email-id"})

    await _client(handler).send(MESSAGE)
    request = requests[0]
    assert str(request.url) == SEND_URL
    assert request.headers["authorization"] == "Bearer the-key"
    body = json.loads(request.content)
    assert body["from"] == "GYMBROS <hola@contact.example.com>"
    assert body["to"] == ["gabi@example.com"]
    assert body["subject"] == MESSAGE.subject
    assert body["html"] == MESSAGE.html
    assert body["text"] == MESSAGE.text


async def test_without_a_key_nothing_is_sent(caplog):
    def handler(_request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request expected")

    with caplog.at_level(logging.INFO, logger="test-email"):
        await _client(handler, api_key="").send(MESSAGE)
    assert "skipped" in caplog.text


async def test_a_rejected_email_is_logged_and_never_raises(caplog):
    await _client(lambda _: httpx.Response(403, json={"message": "nope"})).send(MESSAGE)
    assert "Sending email failed" in caplog.text
    assert "gabi@example.com" not in caplog.text
    assert "the-key" not in caplog.text


async def test_a_network_error_is_logged_and_never_raises(caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    await _client(handler).send(MESSAGE)
    assert "Sending email failed" in caplog.text
