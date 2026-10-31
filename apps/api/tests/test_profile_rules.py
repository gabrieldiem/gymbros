"""Initials, palette colors, invite codes and time zones."""

import pytest

from services.errors import InvalidTimeZone
from services.profile_rules import (
    COLORS,
    INVITE_ALPHABET,
    derive_initials,
    new_invite_code,
    normalize_invite_code,
    pick_color,
    validate_time_zone,
)


@pytest.mark.parametrize(
    ("name", "initials"),
    [("Gabi", "GA"), ("santi", "SA"), ("Ana María", "AM"), ("J", "J"), ("  Jo  ", "JO")],
)
def test_derive_initials(name, initials):
    assert derive_initials(name) == initials


def test_pick_color_takes_the_first_free_palette_color():
    assert pick_color(set()) == "volt"
    assert pick_color({"volt", "red"}) == "cyan"


def test_pick_color_cycles_when_the_palette_is_used_up():
    assert pick_color(set(COLORS)) in COLORS


def test_new_invite_code_uses_the_unambiguous_alphabet():
    code = new_invite_code()
    assert len(code) == 8
    assert set(code) <= set(INVITE_ALPHABET)


def test_normalize_invite_code_ignores_case_spaces_and_dashes():
    assert normalize_invite_code(" iron-ridge ") == "IRONRIDGE"


def test_validate_time_zone_accepts_iana_names():
    assert validate_time_zone("America/Argentina/Buenos_Aires") == "America/Argentina/Buenos_Aires"


@pytest.mark.parametrize("name", ["Mars/Olympus", "", "../etc/passwd"])
def test_validate_time_zone_rejects_unknown_names(name):
    with pytest.raises(InvalidTimeZone):
        validate_time_zone(name)
