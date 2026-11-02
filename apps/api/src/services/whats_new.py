"""What's new: the features members haven't heard about yet, from resources/whats_new.json."""

import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from functools import cache
from pathlib import Path

WHATS_NEW_PATH = Path(__file__).resolve().parent.parent / "resources" / "whats_new.json"


@dataclass(frozen=True, slots=True)
class WhatsNewEntry:
    """A feature members get told about. The web app holds its copy, under its id."""

    id: str
    date: date
    link: str


@cache
def load_whats_new() -> tuple[WhatsNewEntry, ...]:
    """The entries, newest first."""
    raw = json.loads(WHATS_NEW_PATH.read_text(encoding="utf-8"))["entries"]
    entries = tuple(WhatsNewEntry(e["id"], date.fromisoformat(e["date"]), e["link"]) for e in raw)
    if len({e.id for e in entries}) != len(entries):
        raise ValueError("whats_new.json has a repeated id")
    if list(entries) != sorted(entries, key=lambda e: e.date, reverse=True):
        raise ValueError("whats_new.json must be newest first")
    return entries


def unseen_entries(
    entries: Sequence[WhatsNewEntry], seen_id: str | None, joined: datetime
) -> tuple[WhatsNewEntry, ...]:
    """What this account hasn't heard about.

    After the last entry it was told about; an account that was never told hears only about what
    came after it joined, so nobody's first day starts with a list of old news. An id that's no
    longer in the file tells nothing new.
    """
    if seen_id is None:
        return tuple(e for e in entries if e.date > joined.date())
    newer: list[WhatsNewEntry] = []
    for entry in entries:
        if entry.id == seen_id:
            return tuple(newer)
        newer.append(entry)
    return ()
