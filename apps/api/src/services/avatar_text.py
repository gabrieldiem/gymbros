"""What can stand in for a profile picture: up to two characters, as a person counts them."""

import unicodedata

from services.errors import InvalidAvatarText

MAX_CHARACTERS = 2
# What the column holds. A family emoji is 7 code points, so two of the longest fit.
MAX_CODE_POINTS = 32

_ZERO_WIDTH_JOINER = "\u200d"
_SKIN_TONES = range(0x1F3FB, 0x1F400)
_TAGS = range(0xE0020, 0xE0080)
_REGIONAL_INDICATORS = range(0x1F1E6, 0x1F200)
_COMBINING = ("Mn", "Mc", "Me")
_FORBIDDEN = ("Cc", "Cs", "Zl", "Zp")


def _extends_previous(char: str, previous: str) -> bool:
    code = ord(char)
    return (
        char == _ZERO_WIDTH_JOINER
        or previous == _ZERO_WIDTH_JOINER
        or unicodedata.category(char) in _COMBINING
        or code in _SKIN_TONES
        or code in _TAGS
    )


def count_characters(text: str) -> int:
    """How many characters a person would count, joining the code points of one emoji."""
    count = 0
    previous = ""
    flag_half_open = False
    for char in text:
        if ord(char) in _REGIONAL_INDICATORS:
            if not flag_half_open:
                count += 1
            flag_half_open = not flag_half_open
        else:
            flag_half_open = False
            if not previous or not _extends_previous(char, previous):
                count += 1
        previous = char
    return count


def clean_avatar_text(raw: str) -> str:
    """The text without spaces around it. Raises InvalidAvatarText if it can't be shown."""
    text = raw.strip()
    visible = [c for c in text if unicodedata.category(c) not in ("Cf", "Zs")]
    if (
        not visible
        or len(text) > MAX_CODE_POINTS
        or any(unicodedata.category(c) in _FORBIDDEN for c in text)
        or count_characters(text) > MAX_CHARACTERS
    ):
        raise InvalidAvatarText(raw)
    return text
