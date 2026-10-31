"""Main entrypoint for the GYMBROS API."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from controller import general
from db.migrate import run_migrations
from dependencies import engine, logger, settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Migrate (dev only), then dispose of the engine's connection pool on shutdown."""
    logger.info("Starting gymbros-api (env=%s)...", settings.app_env)
    if settings.run_migrations_on_startup:
        await asyncio.to_thread(run_migrations)
        logger.info("Database migrated to head")
    yield
    logger.info("Shutting down gymbros-api...")
    await engine.dispose()


app: FastAPI = FastAPI(
    title="gymbros-api",
    description="GYMBROS: workouts, scoring and the ATUS Climb leaderboard",
    lifespan=lifespan,
)

# Root and health at `/` for the container HEALTHCHECK; the same router under `/api` for the
# browser, which only ever reaches the API through the nginx (or Vite) `/api` proxy.
app.include_router(general.router)
app.include_router(general.router, prefix="/api", include_in_schema=False)
