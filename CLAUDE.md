# CLAUDE.md

GYMBROS is a gym tracker for a crew of five friends (Gabi, Santi, Maxo, Jose, Matex). They log workouts, and every set, PR and goal week earns points that move them up **ATUS Climb**: a mountain trail used as the leaderboard instead of a table. The theme is getting better than you were, not winning a season. The app is bilingual (English and Spanish) and mobile-first.

- Product rules (scoring, ranks, quests, badges, i18n): `docs/PRODUCT.md`
- Visual system: `docs/DESIGN.md`
- Domain terms: `docs/GLOSSARY.md`. Use these names in code, API and UI.
- Clickable reference prototype (single static file, the source of truth for UX and copy): `docs/prototype/index.html`
- Later work and technical debt: the GYMBROS project in Plane (`GYM-N` items, via the `plane` MCP server), mirrored in `BACKLOG.md` as the local backup

`apps/api/CLAUDE.md` and `apps/web/CLAUDE.md` hold the rules for each app. They load automatically when you work inside that folder.

## How to work

1. **Plan, then build.** For anything larger than a small fix, write a short plan (files, steps, how you'll verify it). Then execute without waiting, unless a step needs a product decision that isn't in `docs/` or the backlog. In that case ask, or pick the safest default and log it as a `decide` item with the `backlog` skill.
2. **Branch.** Never commit to `main`. Use one branch per feature or phase: `feat/<name>`, `fix/<name>`, `chore/<name>`.
3. **Commit progressively.** Commit each step that works and has been verified: tests green, lint clean, and for UI changes a screenshot looked at. Keep commits small, in imperative mood, written in plain English ("Add set logging endpoint", "Port ATUS Climb map to React"). Don't batch a whole feature into one commit.
4. **Stay in scope.** Only change code related to the task. Put anything else you notice (bugs, debt, ideas) in the backlog (Plane, mirrored in `BACKLOG.md`) using the `backlog` skill. Don't fix it on the side.
5. **After each step**, say what could break and which tests cover it.
6. **Keep docs true.** When the architecture, commands or a product rule changes, update the matching `CLAUDE.md` or `docs/` file in the same commit.
7. **Don't push, open PRs or deploy** unless asked.

## Commands

```bash
make install     # Poetry deps for apps/api + npm deps for apps/web + pre-commit hooks
make up          # Dev stack in Docker: postgres + api (hot reload) + web (Vite dev server); creates .env on first run
make down        # Stop dev and prod stacks
make test        # API tests in Docker (reports in apps/api/reports/) + web unit tests
make test-api    # API tests only (Docker, against the dev postgres; uses its own gymbros_test database)
make test-web    # Web unit tests only (Vitest)
make e2e         # Rebuild the e2e crews, then Playwright smoke, flows and axe audits against the running dev stack (E2E_BASE_URL=http://localhost:8081 for prod; signed-in specs need the e2e crews, which only dev can seed)
make precommit   # Pre-commit hooks: black, pylint, mypy (api); eslint, prettier, tsc (web)
make prod        # Production build: api + web (React build served by nginx on :8081) + postgres
make local       # Run the api natively with --reload against the dev postgres
make migrate     # Apply Alembic migrations (inside the dev api container)
make migration m="add sets table"   # Autogenerate a new migration
make seed        # Demo crew "Iron Ridge" with history (invite IRONRIDGE; sign in at /login with gabi@demo.gymbros.app); reset=1 rebuilds it
make crew name="ATUS" tz="America/Argentina/Buenos_Aires"   # Create a crew and print its invite code
make clean       # Stop both stacks and delete their database volumes
```

Ports: web dev 5173, api 8080 (`/docs` for OpenAPI), postgres 127.0.0.1:5432, prod web 8081. All configurable in `.env`.

The `run-stack` skill describes how to start the stack and verify a change end to end.

## Repository layout

The layout mirrors the team's `data-service` project (`TFI/apps/data-service`): one folder per app, and each app carries its own Dockerfiles, configuration, `src/` and `tests/`.

```
gymbros/
├── CLAUDE.md  BACKLOG.md (mirror of the Plane backlog)  README.md  Makefile
├── docker-compose.yaml          # prod: postgres + api + web (nginx)
├── docker-compose-dev.yaml      # dev: postgres + api (--reload, ./src mounted) + web (vite)
├── .env.example                 # every env var, no secrets
├── .pre-commit-config.yaml      # black, pylint, mypy, eslint, prettier
├── .github/workflows/
│   ├── test.yml                 # push/PR to non-main: gitleaks, api tests (postgres service), web lint+test+build
│   ├── deploy.yml               # push to main: test.yml; build + Trivy + push both images; deploy via Portainer
│   └── redeploy.yml             # manual: deploy an existing image tag (rollback / apply env changes)
├── deploy/                      # compose.edge.yaml (the production stack), portainer-deploy.sh
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
    │   │   ├── clients/         # external clients: Google OAuth, Resend
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

- **web** (nginx, port 80, published on 8081 by `make prod`) serves the built React app and reverse-proxies `/api/*` to **api**, keeping the `/api` prefix. The browser only ever talks to one origin, so there's no CORS in production. In dev, Vite on 5173 proxies `/api` the same way. nginx caches `/assets/*` (hashed) for a year and serves `index.html` with `no-cache`; unknown paths fall back to `index.html`.
- **api** (FastAPI on uvicorn, port 8080) owns all rules. Scoring, PR detection, goal weeks, ranks, quests, badges and bounties are computed server-side. The client never sends points. `/` and `/health` (database ping, 503 when down) are served at the root for the container healthcheck and again under `/api` for the browser.
- **postgres** 18 is the only data store, through async SQLAlchemy (asyncpg). Weeks run Monday 00:00 to Sunday 23:59 in the crew's time zone.
- **Migrations** are Alembic (`apps/api/migrations`). The dev api runs them in its lifespan (`RUN_MIGRATIONS_ON_STARTUP=true`); the prod image runs `alembic upgrade head` once before starting the uvicorn workers.
- **Config**: `apps/api/settings.json` holds game tuning (points, weekly target, rank step), env vars hold secrets and infrastructure (`.env.example` lists all of them). Any tuning key can be overridden from the environment as its flattened UPPERCASE name (`SCORING_PR=120`).
- **Web shell**: React Router with the five tabs, a bottom nav below 960 px and a side rail above it, TanStack Query for server state (`/api/health` polled every 20 s), and typed EN/ES catalogs. Before sign-in the language comes from `localStorage` or `navigator.language`.
- **Tests**: API tests run offline (pytest-socket) against a real Postgres, each in a rolled-back transaction; the suite creates and migrates its own `gymbros_test` database. Web unit tests use Vitest + Testing Library; Playwright smoke tests run against a live stack at 390×844 and 1440×900, one e2e crew per viewport (`cli.py seed-e2e`, `services/e2e_crews.py`), with each spec logging in as its own member (`tests/e2e/members.ts`).
- **CI**: `test.yml` (gitleaks, api lint + tests with a Postgres service, web lint + tests + build) on every non-main push; `deploy.yml` on main: tests; then each image is built, Trivy-scanned and pushed to `registry.gabrieldiem.com` as `gymbros-{api,web}:<sha>`; then `deploy` runs `deploy/portainer-deploy.sh <sha>`, which sends `deploy/compose.edge.yaml` to the Portainer stack with `IMAGE_TAG=<sha>` (keeping the env vars set in Portainer), waits for the containers to be healthy on that tag and checks `/api/health`. Green means live and healthy. `redeploy.yml` (manual) redeploys an existing tag. GitHub `prod` environment: secrets `REGISTRY_CI_PASSWORD`, `PORTAINER_API_KEY`; variables `PORTAINER_URL`, `PORTAINER_STACK_ID`, `PORTAINER_ENDPOINT_ID`.
- **Hosting**: `https://gymbros.gabrieldiem.com`, the Portainer stack `gymbros` (postgres + api + web from `deploy/compose.edge.yaml`) on an AWS Lightsail box in São Paulo; Caddy terminates TLS and forwards to web on `127.0.0.1:8090`. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are required there or the deploy fails. Env vars and secrets are set in Portainer (Stacks → gymbros → Environment variables) and interpolated into `deploy/compose.edge.yaml` (a new api variable needs a `NAME: ${NAME}` line there too); never commit values. Logs: Portainer or Dozzle.
- Live updates use polling (TanStack Query `refetchInterval`) at first. SSE is in the backlog.
- **Auth**: Google only, no passwords. `GET /api/auth/google/start` stores a one-time attempt (state, nonce, PKCE verifier, language) in the `gymbros_oauth` cookie and redirects to Google; `GET /api/auth/google/callback` checks the state, exchanges the code (`clients/google_oauth_client.py`), checks the ID token's claims (`services/google_identity.py`), finds the account by `users.google_sub`, else links one by verified email, else creates one, then redirects to `/climb`. Failures redirect to `/login?auth_error=google`. A session is a row in `auth_sessions` plus the `gymbros_session` cookie (httpOnly, SameSite=Lax, Secure when `COOKIE_SECURE=true`); the cookie holds a random token and the table holds only its HMAC with `SESSION_SECRET`; signing in deletes expired rows. `get_current_user` resolves it for every protected route. `POST /api/auth/dev-login` signs in by email alone for demo and e2e accounts: it answers 404 unless `DEV_LOGIN_ENABLED`, which production refuses to start with. `GET /api/auth/options` tells the web app which of the two to show. One crew per user (`memberships.user_id` is the key); you join with the crew's invite code after signing in. Crews are created with the CLI (`make crew`), not in the app. `users.password_hash` is unused and nullable until a later migration drops it.
- **Email**: `clients/resend_client.py` sends through Resend, best effort: a failure is logged, never raised, and without `RESEND_API_KEY` it only logs the skip. One email exists: the welcome email (`services/welcome_email.py`, EN and ES), sent as a background task when Google sign-in creates an account.
- **API errors** are `{"detail": {"code": "..."}}` with a machine code (`invite_code_not_found`, `already_in_crew`, `not_authenticated`); domain exceptions are mapped in one handler (`routes/errors.py`). The web app turns codes into copy with `t()`.
- **Train**: the exercise catalog and routines are a resource file (`apps/api/src/resources/catalog.json`), not tables. A workout is in progress while `finished_at` is null (one per user). The logger PUTs its whole state (`PUT /api/workouts/{id}`) through a debounced, serialized autosave queue (`features/train/autosaveQueue.ts`); every response carries `live_points`, the server's score if the workout were finished now. `POST /api/workouts/{id}/finish` runs `score_workout()` and stores one `point_events` row per line item (with the crew-local `week_start`), the workout's points and volume, and new PRs. Starting a routine pre-fills each exercise from its last finished session plus overload.
- **Scoring**: `services/scoring_service.py` is pure: `(WorkoutLog, History, WeekState, ScoringRules) → ScoreResult`. `ScoringContextBuilder` reads history (stored PRs, previous routine volume) and the week state (workouts so far this crew-local week, goal streak) from the DB. Line items are i18n keys (`ln_show`, `ln_sets`, `ln_leg_event`, `ln_vol`, `ln_cardio`, `ln_pr`, `ln_goal`, `ln_streak`, `ln_over`, `ln_better`) with variables; the web renders them with `lineItemText()`.
- **ATUS Climb**: `GET /api/climb?mode=all|week` sums `point_events` per member (all time, or the crew-local week) and returns the rope order with camps, pips, goal streaks, training now, your gaps, next camp and you vs 4 weeks ago (`services/climb_rules.py` is pure). Camps are `game.rank_step` apart (summit at step × 6); week mode scales the same 7 camps to `game.week_scale`. The finish response carries the climb change (points and camps before/after, who you passed). The web map (`features/climb/trail.ts`) samples the prototype's SVG path into an arc-length table, so marker placement is pure and testable; the reveal and markers animate unless reduced motion is on.
- **Crew (social)**: finishing a workout posts an immutable `feed_items` snapshot (keys + vars, plus a `rank_up` item on a new camp). `reactions` (👊 `fist`, 🔥 `fire`) toggle; `comments` hold either the member's text or a quick-reply key (`q_*`), never translated prose. Inactivity nudge prompts (no workout for `social.inactive_days`) are computed when the feed is read; `POST /api/crew/nudges` is limited to one per member per day. `notifications` (keys + vars + in-app link) are written by `services/notifier.py` for: passed you, someone close behind starting a workout, reactions, comments, nudges and weekly goals. Marking the inbox read also deletes that member's notifications older than `social.notification_days` (60). The web polls the feed and inbox every 20 s and toasts new notifications. Hall of fame: most improved = mean of strength and volume change against yourself; crew records = heaviest squat/bench/deadlift, longest goal streak, biggest session.
- **Compete**: after a workout is scored and stored, `BonusService` pays, in order, weekly quests (`resources/quests.json` + the metric registry in `services/quests.py`), the crew quest (every member, once per crew-local week), the bounty (passing this week's all-time leader, once per week) and badges (`resources/badges.json` + the metric registry in `services/badges.py`; social badges are also checked on reactions and comments). Each payout is a point event and a finish-screen line item (`ln_quest`, `ln_crew_quest`, `ln_bounty`, `ln_badge`). Badge unlocks are recorded in `user_badges` and posted to the feed. Duels (`duels`: pending → active → settled, or declined) are settled lazily when anyone in the crew loads `/api/duels` after the week ends; the winner gets `ln_duel` (`scoring.duel_win`). `/api/recap` builds last week's story; `/api/me/stats` and `/api/me/prs/{exercise}` feed the You tab. Charts are hand-built SVG following the dataviz skill (single series, rounded column caps, hover/focus tooltips, screen-reader tables).
- **PWA and resilience**: `vite-plugin-pwa` precaches the app shell (never `/api`); nginx serves `sw.js`, `index.html` and the manifest with `no-cache`. Every data screen goes through `components/QueryState.tsx` (skeleton, inline error with retry; stale data stays on refetch errors). Sheets and the recap make `#root` inert while open. `tests/e2e/a11y.spec.ts` runs axe-core (WCAG 2.1 A/AA) on every screen at 390×844 and 1440×900 with reduced motion.
- **Concurrency rules**: once-per-week crew bonuses (crew quest, bounty) are claimed under a Postgres advisory transaction lock keyed by crew and week (`PointEventRepository.lock`); duels settle through a status-guarded `UPDATE … RETURNING`, so a duel is paid at most once. "Passed" and the bounty compare all-time snapshots taken before the workout and after every bonus is stored. The feed pages with an `(created_at, id)` cursor (`before` + `before_id`).
- **Demo data**: `make seed` builds the demo crew with history planned by `services/demo_history.py` so standings reproduce the prototype's numbers (one `ln_history` point event per seeded workout). `make seed reset=1` rebuilds it. `make e2e` builds separate copies of it for the e2e suite and never touches it.
- **Web routing**: `Gate` components guard routes using `gateRedirect()`: anyone can read `/privacy` and `/terms` (`features/legal/`, also the links Google's consent screen shows); signed-out users see `/welcome` and `/login`; users without a crew see `/join`; members see the five tabs. `/hello` ("This is {crew}") shows once after joining. The UI language follows the profile and the top-bar toggle saves it with `PATCH /api/me`.

Update this section as the system is built. It describes what exists, not what is planned.

## Skills

Project skills live in `.claude/skills/`:

| Skill | Use it when |
|---|---|
| `backlog` | You notice something out of scope, the user says "pick something from the backlog", or they added items in Plane |
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
