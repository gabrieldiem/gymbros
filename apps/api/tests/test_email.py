"""The welcome email's copy and sending it through Resend."""

import json
import logging
from dataclasses import replace

import httpx
import pytest

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

    assert await _client(handler).send(MESSAGE) is True
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
        assert await _client(handler, api_key="").send(MESSAGE) is False
    assert "skipped" in caplog.text


async def test_a_rejected_email_is_logged_and_never_raises(caplog):
    rejected = _client(lambda _: httpx.Response(403, json={"message": "nope"}))
    assert await rejected.send(MESSAGE) is False
    assert "Sending email failed" in caplog.text
    assert "gabi@example.com" not in caplog.text
    assert "the-key" not in caplog.text


async def test_the_log_says_why_resend_refused(caplog):
    # This is the difference between a bad key and an unverified domain.
    refusal = {"name": "validation_error", "message": "The x.com domain is not verified."}
    assert await _client(lambda _: httpx.Response(403, json=refusal)).send(MESSAGE) is False
    assert "HTTP 403, validation_error: The x.com domain is not verified." in caplog.text


async def test_an_address_in_a_refusal_is_masked(caplog):
    refusal = {"name": "invalid_to", "message": "Can't send to gabi@example.com today"}
    await _client(lambda _: httpx.Response(422, json=refusal)).send(MESSAGE)
    assert "gabi@example.com" not in caplog.text
    assert "<address>" in caplog.text


@pytest.mark.parametrize(
    "response", [httpx.Response(502, text="<html>"), httpx.Response(500, json=[])]
)
async def test_a_refusal_without_details_is_still_logged(caplog, response):
    assert await _client(lambda _: response).send(MESSAGE) is False
    assert "no details" in caplog.text


async def test_a_network_error_is_logged_and_never_raises(caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    await _client(handler).send(MESSAGE)
    assert "Sending email failed" in caplog.text


async def test_many_go_out_as_batches_each_to_one_person():
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(json.loads(request.content))
        return httpx.Response(200, json={"data": []})

    messages = [welcome_email(f"m{i}@example.com", "Gabi", "en", "https://x") for i in range(205)]
    assert await _client(handler).send_many(messages) == 205
    assert [len(batch) for batch in requests] == [100, 100, 5]
    assert all(len(item["to"]) == 1 for batch in requests for item in batch)


async def test_a_failed_batch_doesnt_count(caplog):
    calls = []

    def handler(_request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(500 if len(calls) == 1 else 200, json={})

    messages = [welcome_email("a@b.co", "Gabi", "en", "https://x") for _ in range(150)]
    assert await _client(handler).send_many(messages) == 50
    assert "Sending email failed" in caplog.text


async def test_without_a_key_none_of_many_go_out():
    def handler(_request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request expected")

    assert await _client(handler, api_key="").send_many([MESSAGE]) == 0


async def test_headers_are_sent_when_a_message_has_them():
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json={})

    message = replace(MESSAGE, headers=(("List-Unsubscribe", "<https://x/stop>"),))
    await _client(handler).send(message)
    assert bodies[0]["headers"] == {"List-Unsubscribe": "<https://x/stop>"}
