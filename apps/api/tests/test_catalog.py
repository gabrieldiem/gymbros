"""The v1 exercise catalog and routines match docs/PRODUCT.md."""

from services.catalog import load_catalog


def test_catalog_has_the_eighteen_v1_exercises():
    catalog = load_catalog()
    assert len(catalog.exercises) == 18
    assert len({ex.id for ex in catalog.exercises}) == 18


def test_every_routine_uses_known_exercises():
    catalog = load_catalog()
    assert [r.name for r in catalog.routines] == ["Push day", "Pull day", "Leg day", "Cardio"]
    for routine in catalog.routines:
        assert all(catalog.exercise(ex_id) for ex_id in routine.exercise_ids)


def test_exercise_fields():
    catalog = load_catalog()
    squat = catalog.exercise("squat")
    assert squat is not None
    assert (squat.group, squat.type, squat.barbell, squat.ppl) == ("Legs", "w", True, "legs")
    assert "sentadilla" in squat.aliases_es
    assert catalog.exercise("pullup").type == "bw"  # type: ignore[union-attr]
    assert catalog.exercise("run").is_cardio  # type: ignore[union-attr]
    assert catalog.exercise("run").ppl is None  # type: ignore[union-attr]


def test_unknown_ids_return_none():
    catalog = load_catalog()
    assert catalog.exercise("nope") is None
    assert catalog.routine("nope") is None
