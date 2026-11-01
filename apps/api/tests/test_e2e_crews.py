"""E2E crews: one copy of the demo crew per Playwright project, apart from the real demo crew."""

import json

import cli
from cli import build_demo_seed
from db.repositories.crew_repository import CrewRepository
from db.repositories.user_repository import UserRepository
from services.demo_seed_service import DEMO_CREW_PATH
from services.e2e_crews import E2E_PROJECTS, e2e_crew


def _demo() -> dict:
    return json.loads(DEMO_CREW_PATH.read_text(encoding="utf-8"))


def test_each_project_gets_its_own_crew_and_emails():
    crews = [e2e_crew(_demo(), project) for project in E2E_PROJECTS]
    invites = {c["crew"]["invite_code"] for c in crews} | {_demo()["crew"]["invite_code"]}
    emails = [m["email"] for c in [*crews, _demo()] for m in c["members"]]
    assert len(invites) == len(E2E_PROJECTS) + 1
    assert len(set(emails)) == len(emails)


def test_members_keep_the_demo_history_under_project_emails():
    demo, crew = _demo(), e2e_crew(_demo(), "mobile")
    assert crew["crew"] == {
        "name": "E2E Mobile",
        "time_zone": demo["crew"]["time_zone"],
        "invite_code": "E2EMOBILE",
    }
    assert [m["email"] for m in crew["members"]][0] == "gabi@mobile.e2e.gymbros.app"
    assert [m["history"] for m in crew["members"]] == [m["history"] for m in demo["members"]]


def test_the_demo_data_is_not_modified():
    demo = _demo()
    e2e_crew(demo, "desktop")
    assert demo == _demo()


def test_invite_codes_fit_the_column():
    assert all(len(e2e_crew(_demo(), p)["crew"]["invite_code"]) <= 12 for p in E2E_PROJECTS)


async def test_reseeding_an_e2e_crew_rebuilds_it(db_session):
    data = e2e_crew(_demo(), "desktop")
    for _ in range(2):
        service = build_demo_seed(db_session, data)
        await service.reset()
        result = await service.seed()
        assert len(result.created_members) == 5
    crew = await CrewRepository(db_session).get_by_invite_code("E2EDESKTOP")
    assert crew is not None and len(await CrewRepository(db_session).members(crew.id)) == 5
    assert await UserRepository(db_session).get_by_email("gabi@demo.gymbros.app") is None


def test_seed_e2e_refuses_to_run_in_production(monkeypatch, capsys):
    monkeypatch.setattr(cli.settings, "app_env", "production")
    assert cli.main(["seed-e2e"]) == 1
    assert "Refusing" in capsys.readouterr().err
