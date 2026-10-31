---
name: new-feature
description: Checklist for adding a GYMBROS feature end to end (DB table, migration, service, route, API models, web hook, screen, i18n in EN and ES, tests). Use when building any feature that touches both apps/api and apps/web, or a new game rule.
---

# New feature, end to end

Read the relevant part of `docs/PRODUCT.md` first, and check the prototype screen in `docs/prototype/index.html` for the UX and copy. Use the names from `docs/GLOSSARY.md`.

Commit after each numbered block once it's verified. Don't wait until the end.

## 1. API: data

- [ ] Table(s) in `apps/api/src/db/` (UTC timestamps, FKs, indexes on crew_id/user_id/week_start).
- [ ] `make migration m="…"`. Read the generated migration and run `make migrate`.
- [ ] Repository methods (all SQL lives here) plus a test against Postgres.

## 2. API: rules

- [ ] Service in `apps/api/src/services/` with dependencies injected through the constructor.
- [ ] Game rule? Write the test first (`mattpocock-skills:tdd`), one test per rule in PRODUCT.md. Keep it pure: pass `now` and settings in.
- [ ] Tunable numbers go in `settings.json` → `scoring.*` / `game.*`, with defaults in `settings.py`.
- [ ] Domain exceptions, never `HTTPException`.

## 3. API: HTTP

- [ ] Pydantic request/response models in `apps/api/src/models/`.
- [ ] Router in `apps/api/src/routes/`, mounted under `/api` in `main.py`. Crew-scoped authorization at the route.
- [ ] Anything user-visible goes out as `{key, vars}`, never prose.
- [ ] `tests/application/` test: happy path, wrong crew → 404, unauthenticated → 401, invalid input → 422.

## 4. Web

- [ ] Typed client function and TanStack Query hook in `apps/web/src/api/`.
- [ ] Screen or component in `apps/web/src/features/<tab>/`, styled with tokens from `src/styles/tokens.css`, following `docs/DESIGN.md`.
- [ ] Every string through `t()`. Keys added to **both** `en.ts` and `es.ts` (Spanish keeps the English gym terms; see PRODUCT.md → i18n).
- [ ] Loading, empty and error states. An empty state tells the user what to do.
- [ ] Vitest test for logic-bearing hooks and components.

## 5. Verify and wrap up

- [ ] `run-stack` skill: tests, lint, build, screenshots at 390×844 and 1440×900 in EN and ES.
- [ ] Update `docs/PRODUCT.md` if a rule changed, `docs/GLOSSARY.md` for new terms, and the Architecture section of `CLAUDE.md` if the shape changed.
- [ ] Out-of-scope findings go to `BACKLOG.md`.
- [ ] Summary: what was built, what could break, which tests cover it, any new backlog items.
