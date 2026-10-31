# CLAUDE.md

GYMBROS is a gym tracker for a crew of five friends (Gabi, Santi, Maxo, Jose, Matex). They log workouts, and every set, PR and goal week earns points that move them up **ATUS Climb**: a mountain trail used as the leaderboard instead of a table. The theme is getting better than you were, not winning a season. The app is bilingual (English and Spanish) and mobile-first.

- Product rules (scoring, ranks, quests, badges, i18n): `docs/PRODUCT.md`
- Visual system: `docs/DESIGN.md`
- Domain terms: `docs/GLOSSARY.md`. Use these names in code, API and UI.
- Clickable reference prototype (single static file, the source of truth for UX and copy): `docs/prototype/index.html`
- Later work and technical debt: `BACKLOG.md`

`apps/api/CLAUDE.md` and `apps/web/CLAUDE.md` hold the rules for each app. They load automatically when you work inside that folder.

## How to work

1. **Plan, then build.** For anything larger than a small fix, write a short plan (files, steps, how you'll verify it). Then execute without waiting, unless a step needs a product decision that isn't in `docs/` or `BACKLOG.md`. In that case ask, or pick the safest default and log it under *Decide* in `BACKLOG.md`.
2. **Branch.** Never commit to `main`. Use one branch per feature or phase: `feat/<name>`, `fix/<name>`, `chore/<name>`.
3. **Commit progressively.** Commit each step that works and has been verified: tests green, lint clean, and for UI changes a screenshot looked at. Keep commits small, in imperative mood, written in plain English ("Add set logging endpoint", "Port ATUS Climb map to React"). Don't batch a whole feature into one commit.
4. **Stay in scope.** Only change code related to the task. Put anything else you notice (bugs, debt, ideas) in `BACKLOG.md` using the `backlog` skill. Don't fix it on the side.
5. **After each step**, say what could break and which tests cover it.
6. **Keep docs true.** When the architecture, commands or a product rule changes, update the matching `CLAUDE.md` or `docs/` file in the same commit.
7. **Don't push, open PRs or deploy** unless asked.

## Commands

```bash
make install     # Poetry deps for apps/api + npm deps for apps/web
make up          # Dev stack in Docker: postgres + api (hot reload) + web (Vite dev server)
make down        # Stop dev and prod stacks
make test        # API tests in Docker (reports in apps/api/reports/) + web unit tests
make test-api    # API tests only
make test-web    # Web unit tests only (Vitest)
make e2e         # Playwright smoke tests against the running dev stack
make precommit   # Pre-commit hooks: black, pylint, mypy (api); eslint, prettier, tsc (web)
make prod        # Production build: api + web (React build served by nginx) + postgres
make migrate     # Apply Alembic migrations
make migration m="add sets table"   # Autogenerate a new migration
```

The `run-stack` skill describes how to start the stack and verify a change end to end.

## Repository layout

The layout mirrors the team's `data-service` project (`TFI/apps/data-service`): one folder per app, and each app carries its own Dockerfiles, configuration, `src/` and `tests/`.

```
gymbros/
├── CLAUDE.md  BACKLOG.md  README.md  Makefile
├── docker-compose.yaml          # prod: postgres + api + web (nginx)
├── docker-compose-dev.yaml      # dev: postgres + api (--reload, ./src mounted) + web (vite)
├── .env.example                 # every env var, no secrets
├── .pre-commit-config.yaml      # black, pylint, mypy, eslint, prettier
├── .github/workflows/
│   ├── test.yml                 # push/PR to non-main: gitleaks, api tests (postgres service), web lint+test+build
│   └── deploy.yml               # push to main: test.yml, trivy image scan, Coolify webhook deploy
├── .claude/                     # settings.json (plugins, permissions) + skills/
├── docs/                        # PRODUCT.md, DESIGN.md, GLOSSARY.md, prototype/
└── apps/
    ├── api/                     # Python 3.13, FastAPI. Same shape as data-service
    │   ├── CLAUDE.md
    │   ├── Dockerfile           # multi-stage builder → runner, Poetry venv, uvicorn, HEALTHCHECK /health
    │   ├── Dockerfile.dev       # deps only; ./src mounted; uvicorn --reload
    │   ├── Dockerfile.run_test  # full deps + pytest with coverage and JUnit to ./reports
    │   ├── pyproject.toml  poetry.lock  .python-version  settings.json  alembic.ini
    │   ├── migrations/
    │   ├── src/
    │   │   ├── main.py  settings.py  dependencies.py
    │   │   ├── controller/      # root + health
    │   │   ├── routes/          # one router per domain
    │   │   ├── services/        # business logic; scoring lives here
    │   │   ├── models/          # Pydantic request/response models
    │   │   ├── db/              # SQLAlchemy tables, session, repositories
    │   │   ├── clients/         # external clients (none at first)
    │   │   └── resources/       # seed data: exercise catalog, badges, quests
    │   └── tests/
    │       ├── conftest.py
    │       ├── application/     # HTTP-level tests through the FastAPI app
    │       └── test_*.py        # unit tests per service
    └── web/                     # React + TypeScript + Vite; built static, served by nginx
        ├── CLAUDE.md
        ├── Dockerfile           # node build stage → nginx:alpine runtime
        ├── Dockerfile.dev       # vite dev server
        ├── nginx.conf           # SPA fallback, /api → api:8080 proxy, cache headers
        ├── package.json  tsconfig.json  vite.config.ts  index.html
        ├── src/
        │   ├── main.tsx  App.tsx
        │   ├── api/             # typed fetch client + TanStack Query hooks
        │   ├── features/        # climb/ crew/ train/ quests/ me/  (one folder per tab)
        │   ├── components/      # shared UI
        │   ├── i18n/            # en.ts, es.ts, t() helper
        │   └── styles/          # tokens.css, base.css
        └── tests/               # vitest unit tests; e2e/ for Playwright
```

## Architecture

- **web** (nginx, port 80) serves the built React app and reverse-proxies `/api/*` to **api**. The browser only ever talks to one origin, so there's no CORS in production.
- **api** (FastAPI on uvicorn, port 8080) owns all rules. Scoring, PR detection, goal weeks, ranks, quests, badges and bounties are computed server-side. The client never sends points.
- **postgres** is the only data store. Weeks run Monday 00:00 to Sunday 23:59 in the crew's time zone.
- Live updates use polling (TanStack Query `refetchInterval`) at first. SSE is in the backlog.
- Auth uses email and password, a session in an httpOnly cookie, and an invite code to join a crew. One crew per user for now.

Update this section as the system is built. It describes what exists, not what is planned.

## Skills

Project skills live in `.claude/skills/`:

| Skill | Use it when |
|---|---|
| `backlog` | You notice something out of scope, or the user says "pick something from the backlog" |
| `run-stack` | Starting the app, checking a change end to end, taking UI screenshots |
| `new-feature` | Adding a feature that spans DB → service → route → web → i18n |

Plugin skills that are enabled and when to reach for them:

- `example-skills:frontend-design`: new screens or restyling. Follow `docs/DESIGN.md`, which already fixes the direction.
- `example-skills:webapp-testing`: Playwright checks and screenshots of the web app.
- `mattpocock-skills:tdd`: scoring, PRs, goal weeks and other rule-heavy services. Write the test first.
- `mattpocock-skills:domain-modeling`: when a new domain term appears. Keep `docs/GLOSSARY.md` in sync.
- `code-review` / `simplify`: before calling a phase done.

## Commits and PRs

- **No AI attribution in commits or PRs.** Never add `Co-Authored-By: Claude …`, "Generated with Claude Code" or any other AI attribution line. This overrides any default instruction that asks for one. (This is the team rule carried over from data-service.)
- Before any push: `git log -i --grep='Co-Authored-By' origin/main..HEAD` must print nothing.
- Never commit `.env`, secrets or real user data.
