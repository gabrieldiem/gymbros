---
name: run-stack
description: Start the GYMBROS stack (postgres + FastAPI api + React web) and verify a change end to end, including Playwright screenshots of the web app at mobile and desktop sizes. Use when asked to run, start, test, check or screenshot the app, or before committing a UI change.
---

# Run and verify GYMBROS

## Start

```bash
cp -n .env.example .env        # first time only, then fill in values
make up                        # postgres + api (:8080, --reload) + web (:5173, vite)
make seed                      # demo crew; dev login at /login with gabi@demo.gymbros.app (no password)
```

- API docs: http://localhost:8080/docs. Health: `curl -s localhost:8080/health`
- Web: http://localhost:5173 (Vite proxies `/api` to the api)
- Production-like check (nginx serving the built app on :8081): `make prod`, then http://localhost:8081

If `make up` isn't wired yet (early scaffolding), run the pieces natively: a postgres container, `cd apps/api/src && uvicorn main:app --reload --port 8080`, and `cd apps/web && npm run dev`.

## Verify a change

Run what matches the change, and run everything before calling a phase done:

| Changed | Run |
|---|---|
| api code | `make test-api` (or `cd apps/api && poetry run pytest -q path/to/test.py`) + `pre-commit run --all-files` |
| DB schema | `make migration m="…"`, review the generated file, `make migrate`, then the api tests |
| web code | `make test-web` + `cd apps/web && npm run lint && npm run build` |
| any UI | screenshots (below), and actually look at them |
| a whole flow | `make e2e` |

## Screenshots

Use Playwright from `apps/web` (dev dependency). Take two viewports:

- mobile: 390×844, `deviceScaleFactor: 2`, `isMobile: true`, `hasTouch: true`
- desktop: 1440×900

Save to `apps/web/test-results/screens/` (gitignored). Check for:
- `document.documentElement.scrollWidth === 390` on mobile (no sideways overflow)
- no console errors or page errors
- both languages: switch to ES and screenshot the changed screen again
- the calm visual rules in `docs/DESIGN.md` (one loud thing per screen)

The reference look is `docs/prototype/index.html`. Open it with `file://` in the same Playwright session to compare.

## Stop

```bash
make down
```
