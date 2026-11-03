"""A reaction is one emoji, as a person would count it."""

import pytest

from services.emoji_text import is_one_emoji, shown_emoji, stored_kind
from services.errors import InvalidReaction


@pytest.mark.parametrize(
    "emoji",
    ["👊", "🔥", "❤️", "💪🏽", "👨‍👩‍👧‍👦", "🇦🇷", "1️⃣", "🏴‍☠️", "🏳️‍🌈", "😂"],
)
def test_any_emoji_counts(emoji):
    assert is_one_emoji(emoji)


@pytest.mark.parametrize("text", ["", "a", "ok", "<b>", "🔥🔥", "🔥a", "1", " ", "fist bump"])
def test_nothing_else_does(text):
    assert not is_one_emoji(text)


def test_the_first_two_stay_stored_under_their_old_names():
    assert stored_kind("👊") == "fist"
    assert stored_kind("fist") == "fist"
    assert stored_kind("🔥") == "fire"
    assert shown_emoji("fist") == "👊"
    assert stored_kind("😂") == "😂"
    assert shown_emoji("😂") == "😂"


def test_anything_else_is_refused():
    with pytest.raises(InvalidReaction):
        stored_kind("<script>")
