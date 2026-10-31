"""Settings: settings.json loading, env overrides and fail-fast validation."""

import json

import pytest

import settings as settings_module
from settings import Settings


def test_settings_json_values_are_loaded():
    loaded = Settings()
    assert loaded.game_weekly_target == 3
    assert loaded.scoring_pr == 100
    assert loaded.session_cookie_name == "gymbros_session"


def test_flatten_joins_nested_keys():
    assert Settings._flatten({"scoring": {"pr": 100}, "a": 1}) == {"scoring_pr": 100, "a": 1}


def test_env_overrides_tuning_keys_with_their_type(monkeypatch):
    monkeypatch.setenv("SCORING_PR", "120")
    monkeypatch.setenv("SESSION_COOKIE_NAME", "other")
    loaded = Settings()
    assert loaded.scoring_pr == 120
    assert loaded.session_cookie_name == "other"


def test_unknown_settings_json_key_is_warned(tmp_path, caplog):
    path = tmp_path / "settings.json"
    path.write_text(json.dumps({"scoring": {"pr": 90, "typo": 1}}))
    loaded = Settings()
    loaded._load_from_json(path)
    assert loaded.scoring_pr == 90
    assert "scoring_typo" in caplog.text


def test_invalid_app_env_fails_fast(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    with pytest.raises(ValueError, match="APP_ENV"):
        Settings()


def test_missing_postgres_password_fails_fast(monkeypatch):
    monkeypatch.setenv("POSTGRES_PASSWORD", "")
    monkeypatch.setattr(settings_module.Settings, "postgres_password", "")
    with pytest.raises(ValueError, match="POSTGRES_PASSWORD"):
        Settings()


def test_production_requires_long_session_secret(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SESSION_SECRET", "short")
    with pytest.raises(ValueError, match="SESSION_SECRET"):
        Settings()


def test_database_url_escapes_credentials(monkeypatch):
    monkeypatch.setenv("POSTGRES_PASSWORD", "p@ss/word")
    assert ":p%40ss%2Fword@" in Settings().database_url
