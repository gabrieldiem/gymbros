"""Application initializers."""

import logging
from logging import Logger

from settings import Settings

APP_ENV_DEVELOPMENT: str = "development"
_DEV_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
_PROD_FORMAT = '{"t":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}'


def init_logger(settings: Settings) -> Logger:
    """Configure the root logger once and return the app logger."""
    handler = logging.StreamHandler()
    is_dev = settings.app_env == APP_ENV_DEVELOPMENT
    handler.setFormatter(logging.Formatter(_DEV_FORMAT if is_dev else _PROD_FORMAT))

    # Module-level loggers (services.*, db.*) propagate through the same handler and level.
    root_logger = logging.getLogger()
    root_logger.setLevel(settings.log_level)
    root_logger.handlers.clear()
    root_logger.addHandler(handler)

    # Silence httpx's per-request INFO lines; WARNING+ still surfaces.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    # Alembic announces every autogenerate plugin at import time; WARNING+ still surfaces.
    logging.getLogger("alembic.runtime.plugins").setLevel(logging.WARNING)

    logger = logging.getLogger("gymbros")
    logger.setLevel(settings.log_level)
    return logger
