"""Operator CLI guards."""

import cli


def test_seed_demo_refuses_to_run_in_production(monkeypatch, capsys):
    monkeypatch.setattr(cli.settings, "app_env", "production")
    assert cli.main(["seed-demo"]) == 1
    assert "Refusing" in capsys.readouterr().err


def test_migrate_runs_the_migrations(monkeypatch):
    calls = []
    monkeypatch.setattr(cli, "run_migrations", lambda: calls.append("migrated"))
    assert cli.main(["migrate"]) == 0
    assert calls == ["migrated"]
