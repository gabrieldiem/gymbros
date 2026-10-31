"""Main entrypoint for the GYMBROS API."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from controller import general
from db.migrate import run_migrations
from dependencies import engine, logger, settings
from routes import auth, catalog, climb, compete, crew, crews, feed, me, notifications, workouts
from routes.errors import handle_domain_error
from services.errors import DomainError


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
app.add_exception_handler(DomainError, handle_domain_error)

app.include_router(auth.router, prefix="/api")
app.include_router(me.router, prefix="/api")
app.include_router(crews.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
app.include_router(workouts.router, prefix="/api")
app.include_router(crew.router, prefix="/api")
app.include_router(climb.router, prefix="/api")
app.include_router(feed.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(compete.router, prefix="/api")
