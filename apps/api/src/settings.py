"""Configuration settings for the application.

Same shape as data-service: defaults live on the class, `settings.json` (nested, flattened to
underscore-joined names) overrides them, and environment variables override both. Secrets and
infrastructure (database, session secret) are env-only. `_validate()` fails fast at import time.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict
from urllib.parse import quote

from dotenv import load_dotenv

load_dotenv()

APP_ENVS = ("development", "test", "production")


class Settings:
    # pylint: disable=too-many-instance-attributes
    """Application settings: env-only infrastructure plus settings.json game tuning."""

    # --- Env-only: secrets & infrastructure ---
    log_level: str = "INFO"
    app_env: str = "development"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "gymbros"
    postgres_password: str = ""
    postgres_db: str = "gymbros"
    session_secret: str = ""
    cookie_secure: bool = False
    run_migrations_on_startup: bool = False

    # --- Game tuning (settings.json, env overrides) ---
    game_weekly_target: int = 3
    game_rank_step: int = 1500
    game_rank_count: int = 7
    game_week_scale: int = 1500
    game_bodyweight_kg: int = 80
    # The week's twist. v1 has one event, always on: "leg_day_x2". Empty turns it off.
    game_weekly_event: str = "leg_day_x2"

    scoring_showed_up: int = 50
    scoring_completed_set: int = 5
    scoring_leg_event_set_bonus: int = 5
    scoring_volume_kg_per_point: int = 100
    scoring_cardio_minute: int = 3
    scoring_pr: int = 100
    scoring_weekly_goal: int = 150
    scoring_goal_streak_per_week: int = 20
    scoring_goal_streak_max: int = 100
    scoring_over_target: int = 50
    scoring_better_than_last_time: int = 25
    scoring_crew_quest: int = 200
    scoring_crew_quest_goal: int = 4000
    scoring_bounty: int = 150
    scoring_duel_win: int = 150

    social_inactive_days: int = 3
    social_close_behind_points: int = 300
    social_feed_page_size: int = 20

    session_cookie_name: str = "gymbros_session"
    session_max_age_days: int = 30

    # Every tuning attribute declared above. `locals()` is the class namespace at this point.
    _JSON_KEYS = frozenset(
        key
        for key in list(locals())
        if key.startswith(("game_", "scoring_", "session_", "social_")) and key != "session_secret"
    )

    def __init__(self) -> None:
        settings_json_path = Path(__file__).resolve().parent.parent / "settings.json"
        self._load_from_json(settings_json_path)
        self._load_from_env()
        self._validate()

    def _load_from_json(self, settings_json_path: Path) -> None:
        """Apply recognized settings.json keys; warn about unknown ones instead of dropping them."""
        if not settings_json_path.is_file():
            return
        with open(settings_json_path, encoding="utf-8") as f:
            flat = self._flatten(json.load(f))
        unknown = sorted(set(flat) - self._JSON_KEYS)
        if unknown:
            logging.getLogger(__name__).warning(
                "Ignoring unrecognized settings.json keys: %s", ", ".join(unknown)
            )
        for key in self._JSON_KEYS & set(flat):
            setattr(self, key, flat[key])

    @staticmethod
    def _flatten(data: Dict[str, Any]) -> Dict[str, Any]:
        """`{"scoring": {"pr": 100}}` becomes `{"scoring_pr": 100}`."""
        flat: Dict[str, Any] = {}

        def _walk(prefix: str, section: Dict[str, Any]) -> None:
            for key, value in section.items():
                if isinstance(value, dict):
                    _walk(f"{prefix}{key}_", value)
                else:
                    flat[f"{prefix}{key}"] = value

        _walk("", data)
        return flat

    @staticmethod
    def _env_bool(key: str, default: bool) -> bool:
        """Read an env var as bool (truthy: 1/true/yes/on), falling back to default."""
        value = os.getenv(key, "")
        if not value:
            return default
        return value.strip().lower() in ("1", "true", "yes", "on")

    @staticmethod
    def _env_int(key: str, default: int) -> int:
        """Read an env var as int, falling back to default if unset or empty."""
        value = os.getenv(key, "")
        return int(value) if value else default

    def _env_override(self, key: str) -> Any:
        """`SCORING_PR=120` overrides `scoring_pr`, keeping the attribute's type."""
        current = getattr(self, key)
        if isinstance(current, int):
            return self._env_int(key.upper(), current)
        return os.getenv(key.upper(), "") or current

    def _load_from_env(self) -> None:
        """Load env vars. Infrastructure first, then any tuning key as an UPPERCASE override."""
        self.log_level = os.getenv("LOG_LEVEL", "") or self.log_level
        self.app_env = os.getenv("APP_ENV", "") or self.app_env
        self.postgres_host = os.getenv("POSTGRES_HOST", "") or self.postgres_host
        self.postgres_port = self._env_int("POSTGRES_PORT", self.postgres_port)
        self.postgres_user = os.getenv("POSTGRES_USER", "") or self.postgres_user
        self.postgres_password = os.getenv("POSTGRES_PASSWORD", self.postgres_password)
        self.postgres_db = os.getenv("POSTGRES_DB", "") or self.postgres_db
        self.session_secret = os.getenv("SESSION_SECRET", self.session_secret)
        self.cookie_secure = self._env_bool("COOKIE_SECURE", self.cookie_secure)
        self.run_migrations_on_startup = self._env_bool(
            "RUN_MIGRATIONS_ON_STARTUP", self.run_migrations_on_startup
        )
        for key in self._JSON_KEYS:
            setattr(self, key, self._env_override(key))

    def _validate(self) -> None:
        """Fail-fast validation for values with a fixed domain."""
        if self.app_env not in APP_ENVS:
            raise ValueError(f"Invalid APP_ENV={self.app_env!r}; expected one of {APP_ENVS}")
        if not self.postgres_password:
            raise ValueError("POSTGRES_PASSWORD is required")
        if not self.session_secret:
            raise ValueError("SESSION_SECRET is required")
        if self.app_env == "production" and len(self.session_secret) < 32:
            raise ValueError("SESSION_SECRET must be at least 32 characters in production")
        if self.game_weekly_target < 1 or self.game_rank_step < 1:
            raise ValueError("game.weekly_target and game.rank_step must be positive")
        if self.scoring_volume_kg_per_point < 1:
            raise ValueError("scoring.volume_kg_per_point must be positive")

    @property
    def database_url(self) -> str:
        """SQLAlchemy async URL for asyncpg."""
        user = quote(self.postgres_user, safe="")
        password = quote(self.postgres_password, safe="")
        return (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @staticmethod
    def get_settings() -> "Settings":
        """Factory method to create and return a Settings instance."""
        return Settings()
