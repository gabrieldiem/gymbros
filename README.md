# GYMBROS

A gym tracker for a crew of friends. You log workouts, and every set, PR and goal week moves you up **ATUS Climb**, a trail-map leaderboard. The theme is getting better than you were yesterday. English and Spanish, mobile first.

- Try the prototype: open `docs/prototype/index.html` in a browser.
- Product rules: [docs/PRODUCT.md](docs/PRODUCT.md)
- Design system: [docs/DESIGN.md](docs/DESIGN.md)
- Backlog and tech debt: [BACKLOG.md](BACKLOG.md)
- Working on the code (people and Claude): [CLAUDE.md](CLAUDE.md)

Stack: FastAPI (Python 3.13) + Postgres in `apps/api`, React + TypeScript (Vite) served by nginx in `apps/web`, Docker Compose for dev and prod.

## What's in it

- **ATUS Climb**: the trail-map leaderboard (all time or this week), your standing, gaps, next camp, you vs 4 weeks ago, who is training now, and the weekly recap stories.
- **Crew**: the feed of finished workouts, PRs, rank-ups and badges, with 👊/🔥 reactions, comments and quick replies, nudges for members who stopped training, and the hall of fame.
- **Train**: routines pre-filled to beat last time, the set logger with live points from the server, rest timer, plate calculator, and the finish screen with every line item.
- **Quests**: the crew quest, weekly quests, the Leg day x2 event, the bounty, duels, and 15 badges.
- **You**: stats, a 12-week heatmap, weekly tonnage, PRs with progress charts, the rank ladder, history and settings.
- Installable as a PWA, English and Spanish, notifications inbox with toasts.

## Set up

You need **Docker** with Compose v2. For running things outside Docker you also need Python 3.13 with Poetry 2.3.2 and Node 22.13+.

```bash
git clone git@github.com:gabrieldiem/gymbros.git && cd gymbros
cp .env.example .env    # replace the REPLACE_ values (make up copies it for you the first time)
make install            # optional: local deps for editors and the pre-commit hooks
```

## Run it

```bash
make up                 # dev stack: web http://localhost:5173, api http://localhost:8080/docs
make seed               # demo crew "Iron Ridge" with the prototype's history
                        # log in as gabi@demo.gymbros.app / climb-demo-2026 (also maxo, santi, jose, matex)
make seed reset=1       # rebuild the demo crew from scratch
make crew name="ATUS" tz="America/Argentina/Buenos_Aires"   # a real crew; prints its invite code
make down               # stop everything
```

A real crew: create it with `make crew`, share the invite code, and everyone signs up at `/register` with it.

## Test it

```bash
make test               # api tests in Docker (own gymbros_test database) + web unit tests
make e2e                # Playwright against the running dev stack: smoke, Train, Crew, Quests, a11y (axe)
make precommit          # black, pylint, mypy, eslint, prettier, tsc
```

`make e2e` logs in as demo members and finishes real workouts, so run `make seed reset=1` first for clean numbers.

## Production

```bash
make prod               # api + postgres + nginx serving the built web app on http://localhost:8081
```

The api container runs `alembic upgrade head` before starting its workers. In production set `SESSION_SECRET` (32+ characters) and `COOKIE_SECURE=true` behind HTTPS. Pushing to `main` runs `.github/workflows/deploy.yml`: tests, a Trivy scan of both images, then the Coolify webhook (secrets in the `prod` environment).

See [CLAUDE.md](CLAUDE.md#commands) for every command and the architecture.
