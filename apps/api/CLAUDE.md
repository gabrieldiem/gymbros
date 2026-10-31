# CLAUDE.md: api

FastAPI service (Python 3.13, Poetry 2.3.2) that owns every GYMBROS rule: accounts, crews, workouts, scoring, ATUS Climb standings, feed, quests, badges, duels and bounties. Postgres through SQLAlchemy 2 (async, asyncpg) with Alembic migrations.

The structure and conventions copy `TFI/apps/data-service`. When in doubt, do what data-service does.

## Commands

```bash
poetry install
cd src && uvicorn main:app --host 0.0.0.0 --port 8080 --reload     # native dev (needs a running postgres)
poetry run pytest -m "not skip" --cov=src --cov-report=html:reports/coverage
poetry run pytest tests/application/test_basic_endpoints.py::test_health_ok
poetry run alembic upgrade head
poetry run alembic revision --autogenerate -m "add sets table"
pre-commit run --all-files     # black (line length 100), pylint, mypy --check-untyped-defs
```

## Layers

```
routes/       → FastAPI routers. HTTP concerns only: parse, authorize, call a service, map errors to status codes
services/     → Business logic. Scoring, PRs, goal weeks, ranks, quests, badges, bounty, duels
models/       → Pydantic request/response models (the API contract)
db/           → SQLAlchemy tables, async session, repositories (all SQL lives here)
clients/      → External clients (email, push), added only when needed
controller/   → root and /health
resources/    → seed data: exercise catalog, routines, badge and quest definitions
```

- `src/main.py`: FastAPI app, `lifespan` (DB engine up/down, run migrations in dev), routers mounted under `/api`.
- `src/settings.py`: a plain class reading env vars (`os.getenv` + `python-dotenv`) merged with `settings.json`, with a fail-fast `_validate()`, the same as data-service. `settings.json` carries game tuning (points table, weekly target, rank step), so balancing doesn't need a code change.
- `src/dependencies.py`: module-level singletons (settings, logger, engine/session factory) plus `Depends` providers (`get_session`, `get_current_user`).

## Game rules live in one place

- `services/scoring_service.py` is a **pure** function of (workout, history, week state, settings) → itemized points (`[{key, vars, pts}]`). It has no DB access and no clock. Pass `now` in. This is the most heavily tested file in the repo.
- Point values come from `settings.json` → `scoring.*`. Never hard-code them.
- Line items carry an i18n key plus variables, not prose. The web app renders them in the user's language. The same goes for feed events and notifications.
- Points are computed and stored when a workout is finished: `workouts.points` plus `point_events` rows. Standings are a sum over `point_events`, never a counter that gets edited.

## Engineering rules (from data-service)

### FastAPI

- Every handler is `async def`. Wrap blocking I/O in `asyncio.to_thread()`.
- Use `Depends()` for shared logic. Routes take the session and current user through `Depends`, not module imports.
- Type every endpoint with `response_model`, status codes and Pydantic models. Never return raw dicts (health/root excepted).
- Services return values or raise domain exceptions, **never `HTTPException`**. Routes translate them to status codes.
- Use the `lifespan` pattern only, never `@app.on_event`.
- Authorize at the route: a user only ever reads and writes data in their own crew.

### Code style

- Early returns. Functions under 20 lines. One class per file.
- Use verb-noun names, and the `handle_` prefix for event handlers.
- Immutable by default: `@dataclass(frozen=True, slots=True)` for data containers.
- Fail fast: validate early, raise domain-specific exceptions, no bare `except`.
- Make minimal changes: only touch code related to the task.

### Design

- Dependency injection via the constructor: services receive repositories and clients through `__init__`.
- Depend on a Protocol or ABC, and keep interfaces small.
- Prefer composition over inheritance.
- Open/closed: a new badge or quest is a new definition plus an evaluator registered in a typed registry, not another `if` in an existing service.

### Testing

- Use `pytest`, `pytest-asyncio` and `pytest-socket` (network disabled; only `127.0.0.1` and the test DB host allowed).
- Unit-test services through their interfaces with fakes. No DB needed for scoring, PRs or goal weeks.
- `tests/application/` hits the FastAPI app with `httpx.AsyncClient` against a real Postgres (compose service locally, `services: postgres` in CI). Each test runs in a rolled-back transaction.
- Every scoring rule in `docs/PRODUCT.md` gets at least one test, named after the rule.

## Anti-patterns

- ❌ Business logic in routes or repositories
- ❌ Points computed or trusted from the client
- ❌ Hard-coded point values, weekly target or rank thresholds
- ❌ Translated prose stored in the DB or returned by the API (send keys plus variables)
- ❌ Naive datetimes. Store UTC and compute weeks in the crew time zone
- ❌ Blocking I/O in async functions; unbounded task creation
- ❌ Catching `Exception` without re-raising or handling it
