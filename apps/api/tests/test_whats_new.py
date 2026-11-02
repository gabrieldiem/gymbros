"""Who hears about which feature."""

from datetime import UTC, date, datetime

from services.whats_new import WhatsNewEntry, load_whats_new, unseen_entries

NEWEST = WhatsNewEntry("newest", date(2026, 11, 10), "/train")
MIDDLE = WhatsNewEntry("middle", date(2026, 11, 5), "/climb")
OLDEST = WhatsNewEntry("oldest", date(2026, 11, 1), "/me")
ENTRIES = (NEWEST, MIDDLE, OLDEST)
JOINED_LONG_AGO = datetime(2026, 1, 1, tzinfo=UTC)


def test_the_entries_load_newest_first():
    entries = load_whats_new()
    assert entries
    assert list(entries) == sorted(entries, key=lambda e: e.date, reverse=True)


def test_after_being_told_you_only_hear_whats_newer():
    assert unseen_entries(ENTRIES, "oldest", JOINED_LONG_AGO) == (NEWEST, MIDDLE)
    assert unseen_entries(ENTRIES, "middle", JOINED_LONG_AGO) == (NEWEST,)


def test_being_up_to_date_is_nothing_new():
    assert unseen_entries(ENTRIES, "newest", JOINED_LONG_AGO) == ()


def test_an_account_never_told_hears_about_everything_since_it_joined():
    assert unseen_entries(ENTRIES, None, JOINED_LONG_AGO) == ENTRIES
    assert unseen_entries(ENTRIES, None, datetime(2026, 11, 3, tzinfo=UTC)) == (NEWEST, MIDDLE)


def test_a_brand_new_account_starts_with_no_old_news():
    assert unseen_entries(ENTRIES, None, datetime(2026, 11, 10, 9, 0, tzinfo=UTC)) == ()


def test_an_unknown_id_tells_nothing_new():
    assert unseen_entries(ENTRIES, "removed", JOINED_LONG_AGO) == ()
