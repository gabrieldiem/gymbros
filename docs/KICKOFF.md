# Kickoff prompt

Paste this into a fresh Claude Code session at the repo root to start building the real app.

---

Build the real GYMBROS app from the prototype.

Read first: `CLAUDE.md`, `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `docs/PRODUCT.md`, `docs/DESIGN.md`, `docs/GLOSSARY.md`, `BACKLOG.md`. Open `docs/prototype/index.html` with Playwright to see the target UX in both languages. The project structure, Dockerfiles, Makefile, pre-commit, CI and coding conventions must mirror `/mnt/Turing-OS/Users/Gabriel/Desktop/University/TFI/apps/data-service`. Read it (CLAUDE.md, Makefile, pyproject.toml, the three Dockerfiles, the compose files, .pre-commit-config.yaml, .github/workflows, src/main.py, src/settings.py, src/dependencies.py, tests/conftest.py) and copy its patterns, adapted to a Postgres-backed API plus a React frontend served by nginx. Don't copy its domain code (tiles, S3, Redis).

Work through the phases below in order. For each phase:
- Branch from the previous phase's branch (`feat/phase-0-scaffold`, `feat/phase-1-accounts`, …).
- Plan briefly, then build. Commit each step that works and has been verified (tests, lint, and screenshots for UI). Small commits, no AI attribution.
- Finish the phase with everything green (`make test`, `make precommit`, web build, e2e smoke), the docs updated (Architecture section of CLAUDE.md, the README commands), and new findings in BACKLOG.md.
- Post a short summary: what was built, what could break, which tests cover it, any new backlog items. Then continue to the next phase.
- Only stop to ask me when a decision isn't covered by `docs/` and has no safe default. Otherwise pick the default, log it under *Decide* in BACKLOG.md, and keep going.
- Don't push, open PRs or deploy.

**Phase 0: scaffold.** Monorepo per the layout in CLAUDE.md: `apps/api` (FastAPI, Poetry, settings.py + settings.json, dependencies.py, controller with `/` and `/health`, Alembic, pytest + pytest-socket + pytest-asyncio, black/pylint/mypy) and `apps/web` (Vite + React 19 + TS strict, React Router with the five tabs as empty pages, TanStack Query, i18n scaffold en/es with a typed key check, tokens.css from DESIGN.md, Vitest, ESLint/Prettier, Playwright). Docker: api Dockerfile/Dockerfile.dev/Dockerfile.run_test like data-service; web Dockerfile (node build → nginx:alpine) + nginx.conf (SPA fallback, `/api` proxy, long cache for hashed assets, no-cache for index.html). docker-compose-dev.yaml (postgres, api with --reload, web vite) and docker-compose.yaml (postgres, api, web nginx). Makefile targets listed in CLAUDE.md. `.env.example`, `.gitignore`, `.dockerignore`, `.pre-commit-config.yaml`, `.github/workflows/test.yml` (gitleaks, api tests with a postgres service, web lint/test/build) and `deploy.yml` (test → trivy → Coolify webhook, same shape as data-service, secrets as placeholders). Done when `make up` serves the web shell that calls `/api/health`, `make prod` serves the built app through nginx, and `make test` is green.

**Phase 1: accounts and crew.** Users (email, password hash with argon2, display name, initials, color, language), crews (name, time zone, invite code), membership. Register, log in, log out (httpOnly session cookie), join a crew by invite code, `/api/me`. Seed script for the five-person demo crew with the prototype's numbers. Web: welcome/login/join screens, language toggle persisted to the profile, top bar.

**Phase 2: train.** Exercise catalog and routines as seed resources (PRODUCT.md list, English names, Spanish search aliases). Start a workout from a routine or empty, log sets (load/reps or minutes/km), previous-session values, overload pre-fill, PR detection (Epley), finish. `services/scoring_service.py` as a pure function with a test per rule in PRODUCT.md, point events persisted, and the finish response returning line items as keys + vars. Web: the Train tab ported from the prototype (routine cards, logger, rest timer, plate calculator, live points, finish sheet with the line items). "Training now" comes from in-progress workouts.

**Phase 3: ATUS Climb.** Standings (all-time and week), ranks, weekly goal pips, goal streak, gaps, "you vs 4 weeks ago". Web: the hero, the trail SVG map ported from the prototype (contours, trail, camps, markers with collision offsets, reveal, climb animation after a finish), the standing panel, rope order, training-now chips. Poll every 20 s.

**Phase 4: crew.** Feed items (workouts, PRs, badges, rank-ups, nudges), reactions, comments, quick replies, notifications inbox + toasts (someone passed you, someone close behind, reactions, replies, goal hit). Hall of fame: most improved and crew records.

**Phase 5: compete.** Weekly quests, crew quest, duels, bounty, the weekly event (Leg day x2), badges (all 15, evaluated through a typed registry), and the weekly recap stories. Profile tab: stats, heatmap, tonnage chart, PRs with progress chart, rank ladder, history, settings.

**Phase 6: polish.** PWA (manifest, app-shell cache, install prompt), loading/empty/error states everywhere, accessibility pass (focus, labels, reduced motion), then run the `code-review` skill on the full diff since `main` and fix what's real. Update README with setup and run instructions.

Start with Phase 0.
