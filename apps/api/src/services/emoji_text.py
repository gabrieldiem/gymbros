"""What counts as a reaction: one emoji, whichever one, as a person would count it."""

import unicodedata

from services.avatar_text import count_characters
from services.errors import InvalidReaction

_MAX_CODE_POINTS = 32
_LEGACY = {"👊": "fist", "🔥": "fire"}
_FROM_LEGACY = {kind: emoji for emoji, kind in _LEGACY.items()}
_VARIATION_SELECTOR = "\ufe0f"
_KEYCAP = "\u20e3"


def _starts_an_emoji(text: str) -> bool:
    first = text[0]
    if unicodedata.category(first) == "So":
        return True
    # Keycaps (1️⃣) and the few emoji that are punctuation until a selector asks for a picture.
    return _VARIATION_SELECTOR in text or _KEYCAP in text


def is_one_emoji(text: str) -> bool:
    """One emoji, including flags, skin tones and families. Never letters or markup."""
    if not text or len(text) > _MAX_CODE_POINTS or count_characters(text) != 1:
        return False
    return _starts_an_emoji(text)


def stored_kind(value: str) -> str:
    """How a reaction is stored. Raises if it isn't one emoji. The first two keep their old names,
    so a version from before this still counts them if a deploy rolls back."""
    if value in _FROM_LEGACY:
        return value
    if not is_one_emoji(value):
        raise InvalidReaction(value[:_MAX_CODE_POINTS])
    return _LEGACY.get(value, value)


def shown_emoji(kind: str) -> str:
    """The emoji for a stored reaction."""
    return _FROM_LEGACY.get(kind, kind)
