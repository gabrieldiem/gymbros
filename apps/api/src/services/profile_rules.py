"""Small pure rules for profiles and crews: initials, colors, invite codes, time zones."""

import secrets
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from services.errors import InvalidTimeZone

# Crew palette from docs/DESIGN.md, in assignment order.
COLORS = ("volt", "red", "cyan", "pink", "violet")
LANGUAGES = ("en", "es")
# No 0/O or 1/I so codes read clearly when shared out loud.
INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
INVITE_LENGTH = 8


def derive_initials(display_name: str) -> str:
    """ "Gabi" → "GA", "Ana María" → "AM". Always two upper-case characters when possible."""
    words = display_name.split()
    if len(words) >= 2:
        return (words[0][0] + words[1][0]).upper()
    return display_name.strip()[:2].upper()


def pick_color(taken: set[str]) -> str:
    """The first palette color nobody in the crew has. Colors repeat past five members."""
    return next((color for color in COLORS if color not in taken), COLORS[len(taken) % len(COLORS)])


def new_invite_code() -> str:
    """A random 8-character invite code."""
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(INVITE_LENGTH))


def normalize_invite_code(raw: str) -> str:
    """Codes are case-insensitive and may be typed with spaces or dashes."""
    return "".join(ch for ch in raw.upper() if ch.isalnum())


def validate_time_zone(name: str) -> str:
    """Return the name if it is an IANA zone, else raise InvalidTimeZone."""
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise InvalidTimeZone(name) from error
    return name
