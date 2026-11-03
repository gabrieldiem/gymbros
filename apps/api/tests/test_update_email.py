"""The weekly digest's copy, when it's due, and who an unsubscribe link works for."""

import uuid
from datetime import UTC, datetime

import pytest

from services.email_service import digest_is_due
from services.unsubscribe import token_is_valid, unsubscribe_query, unsubscribe_token
from services.update_email import (
    DigestNumbers,
    Recipient,
    admin_email,
    digest_email,
    html_to_text,
    merge_tags,
    style_fragment,
)

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


def written(html="<p>Text</p>", full_document=False, subject="Hi", name="Gabi"):
    who = Recipient("a@b.co", name, "en", STOP, ONE_CLICK)
    return admin_email(who, subject, html, "https://app.example.com", full_document)


def test_every_update_can_be_stopped_with_one_click():
    for message in (digest(), written(), written("<html><body>Hi</body></html>", True)):
        assert STOP.replace("&", "&amp;") in message.html
        assert STOP in message.text
        assert dict(message.headers) == {
            "List-Unsubscribe": f"<{ONE_CLICK}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }


def test_names_cant_inject_html():
    message = digest(numbers=DigestNumbers("<img src=x>", 10, 1, 3, 10, ("<b>", 1), None))
    assert "<img src=x" not in message.html
    assert "<b>," not in message.html


def test_what_the_editor_writes_goes_in_the_frame_with_styles_mail_apps_keep():
    message = written("<h2>News</h2><p>Hello</p><ul><li>One</li></ul>")
    assert "/email/banner.png" in message.html
    assert '<h2 style="' in message.html
    assert '<p style="' in message.html
    assert '<li style="' in message.html


def test_a_style_of_your_own_stays():
    assert '<p style="color:red">x</p>' in style_fragment('<p style="color:red">x</p>')


def test_a_whole_email_goes_as_written():
    html = '<html><body><p style="color:red">Mine</p></body></html>'
    message = written(html, True)
    assert "/email/banner.png" not in message.html
    assert '<p style="color:red">Mine</p>' in message.html


def test_a_whole_email_that_forgot_the_stop_link_gets_one_before_it_ends():
    message = written("<html><body><p>Mine</p></body></html>", True)
    assert message.html.index("Stop these emails") < message.html.index("</body>")
    assert written("<p>No body tag</p>", True).html.count("Stop these emails") == 1


def test_a_template_with_its_own_stop_link_doesnt_get_another():
    html = '<a href="{{unsubscribe_url}}">Bye</a>'
    assert "Stop these emails" not in written(html, True).html


def test_the_tags_fill_in_for_each_person_everywhere():
    message = written("<p>Hi {{name}}</p><a href='{{app_url}}'>Go</a>", subject="Yo {{ name }}")
    assert "Hi Gabi" in message.html
    assert "https://app.example.com'" in message.html
    assert message.subject == "Yo Gabi"
    assert "Hi Gabi" in message.text


def test_a_name_in_a_tag_cant_inject_html_or_another_tag():
    message = written("<p>{{name}}</p>", name="<b>{{unsubscribe_url}}")
    assert "<b>" not in message.html
    assert "&lt;b&gt;{{unsubscribe_url}}" in message.html
    assert merge_tags("{{name}}", "<b>", "u", "s", as_html=False) == "<b>"


def test_the_plain_version_keeps_the_words_and_where_links_go():
    text = html_to_text(
        "<head><style>p{}</style><title>No</title></head><h2>News</h2><p>See <a href='https://x'>"
        "this</a></p><ul><li>One</li><li>Two</li></ul><img alt='Logo'>"
    )
    assert "No" not in text
    assert "p{}" not in text
    assert "See this (https://x)" in text
    assert "- One\n- Two" in text.replace("\n\n", "\n")
    assert "Logo" in text


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
