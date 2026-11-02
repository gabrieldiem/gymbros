"""The weekly digest's copy, when it's due, and who an unsubscribe link works for."""

import uuid
from datetime import UTC, datetime

import pytest

from services.email_service import digest_is_due
from services.unsubscribe import token_is_valid, unsubscribe_query, unsubscribe_token
from services.update_email import DigestNumbers, admin_email, digest_email

NUMBERS = DigestNumbers(
    name="Gabi",
    points=540,
    workouts=3,
    target=3,
    crew_total=2100,
    climber=("Maxo", 700),
    pr=("Santi", 142.5),
)
STOP = "https://app.example.com/unsubscribe?u=1&t=2"
ONE_CLICK = "https://app.example.com/api/email/unsubscribe?u=1&t=2"
ZONE = "America/Argentina/Buenos_Aires"


def digest(language="en", numbers=NUMBERS):
    return digest_email("a@b.co", language, numbers, "https://app.example.com", STOP, ONE_CLICK)


def test_the_digest_tells_your_week_and_the_crews():
    message = digest()
    assert message.subject == "Your week on GYMBROS: +540 points"
    for text in (
        "Hi Gabi",
        "540 points and 3 of 3",
        "2100 points",
        "Maxo, with 700",
        "Santi, 142.5",
    ):
        assert text in message.text


def test_the_digest_follows_the_member_language():
    message = digest("es")
    assert message.subject == "Tu semana en GYMBROS: +540 puntos"
    assert "Hola Gabi" in message.text


def test_a_week_you_didnt_train_says_so_kindly():
    message = digest(numbers=DigestNumbers("Gabi", 0, 0, 3, 2100, None, None))
    assert message.subject == "Your crew's week on GYMBROS"
    assert "didn't log anything" in message.text
    assert "Biggest climber" not in message.text


def test_every_update_can_be_stopped_with_one_click():
    for message in (digest(), admin_email("a@b.co", "en", "Hi", "Text", STOP, ONE_CLICK)):
        assert STOP.replace("&", "&amp;") in message.html
        assert STOP in message.text
        assert dict(message.headers) == {
            "List-Unsubscribe": f"<{ONE_CLICK}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }


def test_names_cant_inject_html():
    message = digest(numbers=DigestNumbers("<img src=x>", 10, 1, 3, 10, ("<b>", 1), None))
    assert "<img" not in message.html
    assert "<b>," not in message.html


def test_an_admins_message_is_never_html():
    message = admin_email("a@b.co", "en", "Hi", "<script>x</script>\nline\n\nnext", STOP, ONE_CLICK)
    assert "<script>" not in message.html
    assert "&lt;script&gt;" in message.html
    assert "line<br>" not in message.text
    assert "<br>line" in message.html
    assert message.html.count("<p") == 4  # the logo, two paragraphs and the footer


@pytest.mark.parametrize(
    ("moment", "hour", "due"),
    [
        (datetime(2026, 11, 2, 12, 0, tzinfo=UTC), 9, True),  # Monday 09:00 there
        (datetime(2026, 11, 2, 11, 59, tzinfo=UTC), 9, False),  # Monday 08:59 there
        (datetime(2026, 11, 2, 23, 0, tzinfo=UTC), 9, True),  # later on Monday catches up
        (datetime(2026, 11, 3, 2, 0, tzinfo=UTC), 9, True),  # still Monday 23:00 there
        (datetime(2026, 11, 3, 3, 0, tzinfo=UTC), 9, False),  # Tuesday there
        (datetime(2026, 11, 2, 2, 0, tzinfo=UTC), 0, False),  # still Sunday there
        (datetime(2026, 11, 2, 3, 0, tzinfo=UTC), 0, True),  # Monday 00:00 there
    ],
)
def test_the_digest_is_due_on_monday_from_the_hour_in_crew_time(moment, hour, due):
    assert digest_is_due(moment, ZONE, hour) is due


def test_a_link_only_works_for_its_own_member():
    user, other = uuid.uuid4(), uuid.uuid4()
    token = unsubscribe_token(user, "secret")
    assert token_is_valid(user, token, "secret")
    assert not token_is_valid(other, token, "secret")
    assert not token_is_valid(user, token, "another secret")
    assert not token_is_valid(user, "nope", "secret")
    assert f"u={user}" in unsubscribe_query(user, "secret")
