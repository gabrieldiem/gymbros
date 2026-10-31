# GYMBROS

A gym tracker for a crew of friends. You log workouts, and every set, PR and goal week moves you up **ATUS Climb**, a trail-map leaderboard. The theme is getting better than you were yesterday. English and Spanish, mobile first.

- Try the prototype: open `docs/prototype/index.html` in a browser.
- Product rules: [docs/PRODUCT.md](docs/PRODUCT.md)
- Design system: [docs/DESIGN.md](docs/DESIGN.md)
- Backlog and tech debt: [BACKLOG.md](BACKLOG.md)
- Working on the code (people and Claude): [CLAUDE.md](CLAUDE.md)

Stack: FastAPI (Python 3.13) + Postgres in `apps/api`, React + TypeScript (Vite) served by nginx in `apps/web`, Docker Compose for dev and prod.

## Run it

You need Docker (with Compose v2). For working outside Docker: Python 3.13 with Poetry 2.3.2, and Node 22.13+.

```bash
cp .env.example .env    # then replace the REPLACE_ values (make up does the copy for you)
make up                 # http://localhost:5173 (web), http://localhost:8080/docs (api)
make test               # api tests in Docker + web unit tests
make e2e                # Playwright smoke tests against the running dev stack
make prod               # production build behind nginx on http://localhost:8081
make down               # stop everything
```

`make install` sets up local dependencies and the pre-commit hooks; `make precommit` runs them. See [CLAUDE.md](CLAUDE.md#commands) for every command.
