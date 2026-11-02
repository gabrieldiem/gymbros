"""What can stand in for a profile picture: up to two characters, as a person counts them."""

import pytest

from services.avatar_text import clean_avatar_text, count_characters
from services.errors import InvalidAvatarText


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("G", 1),
        ("GD", 2),
        ("ñá", 2),
        ("🔥", 1),
        ("🔥💪", 2),
        ("👍🏽", 1),  # skin tone
        ("👨‍👩‍👧‍👦", 1),  # family: four people joined
        ("🏳️‍🌈", 1),  # flag with a variation selector and a joiner
        ("🇦🇷", 1),  # flag: two regional indicators
        ("🇦🇷🇪🇸", 2),
        ("1️⃣", 1),  # keycap
        ("é", 1),  # e + combining accent
        ("字", 1),
        ("abc", 3),
    ],
)
def test_counting_characters_as_a_person_does(text, expected):
    assert count_characters(text) == expected


@pytest.mark.parametrize("text", ["G", "GD", "gd", "🔥", "🔥💪", "👨‍👩‍👧‍👦🇦🇷", "A🔥"])
def test_up_to_two_characters_are_kept_as_typed(text):
    assert clean_avatar_text(text) == text


def test_spaces_around_are_dropped():
    assert clean_avatar_text("  🔥 ") == "🔥"


@pytest.mark.parametrize("text", ["", "   ", "abc", "🔥🔥🔥", "a\nb", "a\x00", "\u200d"])
def test_anything_else_is_refused(text):
    with pytest.raises(InvalidAvatarText):
        clean_avatar_text(text)


def test_a_very_long_single_character_is_refused():
    with pytest.raises(InvalidAvatarText):
        clean_avatar_text("a" + "\u0301" * 40)
