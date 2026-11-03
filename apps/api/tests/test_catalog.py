"""The v1 exercise catalog and routines match docs/PRODUCT.md."""

from services.catalog import load_catalog


def test_catalog_has_every_exercise_once():
    catalog = load_catalog()
    assert len(catalog.exercises) == 80
    assert len({ex.id for ex in catalog.exercises}) == 80


def test_every_routine_uses_known_exercises():
    catalog = load_catalog()
    assert [r.name for r in catalog.routines] == [
        "Push day",
        "Pull day",
        "Leg day",
        "Cardio",
        "Run",
        "Swim",
        "Stretching",
    ]
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


def test_every_exercise_can_be_found_in_both_languages():
    exercises = load_catalog().exercises
    assert len({e.id for e in exercises}) == len(exercises)
    assert len({e.name for e in exercises}) == len(exercises)
    assert all(e.aliases_es for e in exercises)


def test_the_common_movements_are_there():
    ids = {e.id for e in load_catalog().exercises}
    assert {"pushup", "hipthrust", "cablerow", "facepull", "hammer", "crunch", "bike"} <= ids


def test_cardio_distance_is_weighed_for_every_sport():
    cardio = [e for e in load_catalog().exercises if e.is_cardio]
    assert all(e.km_factor > 0 for e in cardio)
    # A km on a bike is worth far less than a km on foot, or it would pay for coasting.
    by_id = {e.id: e for e in cardio}
    assert by_id["cycling"].km_factor < by_id["outrun"].km_factor < by_id["swim"].km_factor


def test_only_lifts_have_a_push_pull_or_legs_day():
    for exercise in load_catalog().exercises:
        if exercise.is_cardio or exercise.is_stretch or exercise.group in {"Core", "Custom"}:
            assert exercise.ppl is None
        else:
            assert exercise.ppl in {"push", "pull", "legs"}


def test_the_names_a_member_asked_for_can_be_found():
    wanted = {
        "sentadilla hack": "hacksquat",
        "sentadilla zumo": "sumosquat",
        "aductories con maquina": "adductor",
        "prensa": "legpress",
        "estocadas": "lunge",
        "patada de gluteos": "kickback",
        "extension de cuatriceps": "legext",
        "camilla de isotobiales": "legcurl",
        "hip trust": "hipthrust",
        "muai tai": "muaythai",
    }
    by_id = {e.id: e for e in load_catalog().exercises}
    for name, exercise_id in wanted.items():
        assert name in by_id[exercise_id].aliases_es, name
