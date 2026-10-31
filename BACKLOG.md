# Backlog

Work that matters but isn't the current task. The `backlog` skill (`.claude/skills/backlog/SKILL.md`) describes how to add, pick up and close items.

Format: `- [ ] **Short title** (area, size S/M/L): why it matters / what done looks like. _Added YYYY-MM-DD_`

## Decide

Product or technical decisions that are still open. If one blocks work, pick the safest default, note it here, and continue.

- [ ] **Crew name** (product, S): it's still the placeholder "Iron Ridge". Is ATUS the crew name? _Added 2026-10-31_
- [ ] **Weekly event name** (product, S): English says "Leg storm", Spanish says "Leg day x2". Pick one shared name. Default chosen: "Leg day x2" in both languages (`leg_event_name`). _Added 2026-10-31_
- [ ] **Units** (product, M): kg only in v1. Add a per-user kg/lb toggle? _Added 2026-10-31_
- [ ] **Anti-cheat** (product, L): trust the crew, or require proof (photo/video for PRs, crew confirmation)? _Added 2026-10-31_
- [ ] **Hosting** (infra, M): where does GYMBROS run, and on which domain? `deploy.yml` has a placeholder `deploy` job (tests and the image scan still run on main); the data-service Coolify webhook flow is in its git history if that's the choice. _Added 2026-10-31_
- [ ] **Spanish slang** (i18n, S): Spanish rank names (Novato … Imparable) and other words the crew actually uses. _Added 2026-10-31_
- [ ] **Production migrations** (infra, S): default chosen: the api image runs `alembic upgrade head` before starting the workers, so a deploy migrates itself. Alternative: a separate one-off migrate job on the hosting platform. _Added 2026-10-31_
- [ ] **Who creates a crew** (product, S): default chosen: crews are created by an operator with `make crew` (CLI) and shared by invite code; there is no in-app "create crew". Add an in-app flow if the app should onboard other groups. _Added 2026-10-31_
- [ ] **Crew time zone** (product, S): default chosen: the demo crew uses `America/Argentina/Buenos_Aires`. Confirm the real crew's zone (weeks reset Monday 00:00 there). _Added 2026-10-31_
- [ ] **First log of an exercise and PR points** (game, S): default chosen: the first time you log an exercise it sets your baseline PR and pays nothing; PRODUCT.md says a PR must beat the stored one. The prototype paid 100 for it, which lets anyone farm points by logging every exercise once. _Added 2026-10-31_
- [ ] **Most improved formula** (game, S): default chosen: the mean of strength change (squat/bench/deadlift e1RM vs 4 weeks ago) and volume change (last 3 weeks vs the 3 before), over whichever the member has history for. The prototype's "+18%" had no formula. _Added 2026-10-31_
- [ ] **Who hears about a goal hit** (product, S): default chosen: the rest of the crew gets "X hit the weekly goal". The finisher already sees it on the finish screen. _Added 2026-10-31_
- [ ] **Bounty rules** (game, S): default chosen: the bounty is always on the all-time leader and pays the first member to pass them each week. The prototype only said "while a bounty is active". _Added 2026-10-31_
- [ ] **Badges earned by seeded history** (product, S): default chosen: demo members get the badges their seeded history earns, with no extra points, so the prototype's totals stay exact. _Added 2026-10-31_

## Later

- [ ] **Scoring balance pass** (game, M): a jackpot day reaches about 1,200 pts against 150 to 250 for a normal day. Simulate a month for 5 profiles and flatten it if one day decides the week. _Added 2026-10-31_
- [ ] **Bodyweight from profile** (game, S): bodyweight exercises assume an 80 kg load. Use each member's bodyweight. _Added 2026-10-31_
- [ ] **More weekly events** (game, M): only Leg day x2 exists. Add a rotating set (Pull week, Cardio week, Volume week). _Added 2026-10-31_
- [ ] **Live updates via SSE** (api+web, M): replace 20 s polling for standings, feed and "training now". _Added 2026-10-31_
- [ ] **Web push notifications** (web, M): "Maxo passed you" when the app is closed. _Added 2026-10-31_
- [ ] **Custom routines and exercises** (product, M): v1 ships a fixed catalog and four routines. _Added 2026-10-31_
- [ ] **Hero height on mobile** (web, S): the headline fills the first screen and pushes the map below the fold. _Added 2026-10-31_
- [ ] **Health app import** (product, L): Apple Health / Google Fit cardio. _Added 2026-10-31_
- [ ] **Login rate limiting** (api, S): `/api/auth/login` and `/register` have no throttle. Add a per-IP and per-email limit before the app is public. _Added 2026-10-31_
- [ ] **Password reset** (product, M): there is no email client, so a forgotten password needs an operator. Add reset by email or an operator CLI command. _Added 2026-10-31_
- [ ] **Expired session cleanup** (api, S): expired `auth_sessions` rows are ignored but never deleted. Delete them on login or in a periodic job. _Added 2026-10-31_
- [ ] **Leave or switch crew** (product, S): one crew per user and no way to leave. Needed if someone joins the wrong crew. _Added 2026-10-31_
- [ ] **Show the current PR in the logger** (web, S): the prototype shows "PR 92.5 kg × 5" next to each exercise and in the picker. Needs a PRs endpoint (Phase 5 builds one for the profile). _Added 2026-10-31_
- [ ] **Rest timer length setting** (web, S): fixed at 90 s. Make it a user setting (Phase 5 settings). _Added 2026-10-31_
- [ ] **Offline logging** (web, M): the logger retries saves while offline, but a reload loses unsaved edits. Persist the draft locally until the server confirms it. _Added 2026-10-31_
- [ ] **Prototype: first-time PR** (docs, S): the prototype awards 100 pts for the first log of an exercise; the app does not (see Decide). Note it if the prototype is kept. _Added 2026-10-31_
- [ ] **Climber sheet** (web, M): tapping a marker or rope row in the prototype opens a profile sheet (head to head, last workout, best lift, gap, Start a duel, Nudge). Duels and nudges arrive in Phases 4–5; build the sheet then. _Added 2026-10-31_
- [ ] **YOU tag can overlap a marker** (web, S): on the map, the "YOU" label above your marker can touch a neighbour nudged just above it (same as the prototype). Offset the tag away from neighbours. _Added 2026-10-31_
- [ ] **Climb standings query cost** (api, S): `/api/climb` runs several aggregates per poll (every 20 s per open tab). Fine for 5 people; cache per crew for a few seconds if crews grow. _Added 2026-10-31_
- [ ] **Reply notifications for commenters** (api, S): only the post's owner is notified of new comments; others in the thread aren't (the prototype's "replied to your comment"). _Added 2026-10-31_
- [ ] **Notification fan-out to the actor's camp-mates** (api, S): "someone close behind" uses a fixed 300 pt window (`social.close_behind_points`). Consider week mode too. _Added 2026-10-31_
- [ ] **Delete own comment / undo nudge** (product, S): neither exists. _Added 2026-10-31_
- [ ] **Old notifications cleanup** (api, S): notifications are never deleted; the inbox shows the newest 30. Prune after 60 days. _Added 2026-10-31_
- [ ] **Weekly recap notification** (api, S): "Your weekly recap is ready" isn't sent; the recap is a card on ATUS Climb. Send it on the first request after Monday 00:00. _Added 2026-10-31_
- [ ] **Duel settlement needs a visit** (api, S): duels settle when someone in the crew opens the Quests tab after the week. A small scheduled job would pay winners on Monday morning even if nobody opens it. _Added 2026-10-31_
- [ ] **Event and bounty sheets** (web, S): the prototype opens a sheet from the hero chips; the app shows them as cards on the Quests tab only. _Added 2026-10-31_
- [ ] **Crew palette contrast** (design, S): the dataviz validator flags the crew colors on the dark surface (lightness band; pink/violet ΔE 7.0 for deutan vision). Charts that use them always add a legend with names; consider a darker violet step. _Added 2026-10-31_
- [ ] **Tonnage chart y-axis** (web, S): only this week's bar is labelled (the rest via tooltip and table). Add light y ticks if people ask for exact values at a glance. _Added 2026-10-31_

## Tech debt

- [ ] **Prototype is one 2,100-line file** (docs, S): `docs/prototype/index.html` is reference only. Don't extend it; port features into `apps/web`. Delete it once everything is ported. _Added 2026-10-31_
- [ ] **Node 22.22+ for latest web deps** (web, S): React Router 8 and jsdom 30 need Node ≥22.22. The local machine runs 22.17, so the web app pins React Router 7.18 and jsdom 29. Upgrade Node, then bump both. _Added 2026-10-31_
- [ ] **ESLint toolchain audit warning** (web, S): `npm audit` reports a moderate minimatch advisory inside ESLint/typescript-eslint (dev-only, not shipped). Clear it when upstream releases a fix. _Added 2026-10-31_
- [ ] **Poetry hangs on keyring in headless shells** (infra, S): `poetry install` stalled with no output until run with `PYTHON_KEYRING_BACKEND=keyring.backends.null.Keyring`. Consider setting it in the Makefile `install` target. _Added 2026-10-31_
- [ ] **E2E depends on the demo seed** (web, S): the Playwright smoke logs in as demo members and toggles their language, so it needs `make seed` and touches the dev database. `make seed reset=1` now rebuilds the crew; run it before `make e2e` from the Makefile, or give e2e its own crew. _Added 2026-10-31_
- [ ] **E2E logs real workouts** (web, S): `tests/e2e/train.spec.ts` finishes a workout for demo members Jose and Matex on every run, so their points grow in the dev database. Same fix as the seed item: an e2e-only crew reset before each run. _Added 2026-10-31_
- [ ] **Pylint inference on table modules** (api, S): `db/tables/workout.py` and `workout_set.py` disable `unsubscriptable-object` because astroid mis-infers `Mapped` in a full run. Remove when astroid fixes it. _Added 2026-10-31_
- [ ] **Bonus lock has no concurrency test** (api, S): the advisory lock around crew-quest and bounty claims is exercised by every finish, but no test runs two finishes in parallel (the suite runs each test inside one rolled-back transaction). Add a test with two committed sessions. _Added 2026-10-31_
- [ ] **E2E specs share demo members** (web, S): five demo members across five specs at two viewports means specs can see each other's side effects (an in-progress workout, unread notifications). The a11y spec now tolerates that, but each spec should own its member. _Added 2026-10-31_
- [ ] **Precache size** (web, S): the service worker precaches ~815 KiB, mostly Barlow font weights. Trim unused weights or subset the fonts. _Added 2026-10-31_
- [ ] **Drop the targeted apk upgrade in the web image** (infra, S): `apps/web/Dockerfile` upgrades `brotli-libs`, `curl` and `libcurl` on top of `nginx:1.30-alpine` (CVE-2026-111497 was CRITICAL and failed the deploy scan). Remove that line once a newer `nginx:1.30-alpine` ships brotli-libs ≥ 1.2.1-r0 and curl ≥ 8.23.0. _Added 2026-10-31_
- [ ] **pip-vendored HIGHs in the api image** (infra, S): Trivy reports msgpack 1.1.2, urllib3 2.7.0 and setuptools 70.3.0 as HIGH. They are copies vendored inside `pip` (base image and the venv), which the app never runs; they don't fail the deploy (CRITICAL only). Build the runtime venv without pip, or wait for a python:3.13-slim image with a newer pip. _Added 2026-10-31_

## Done

Move items here with the date and the commit or PR that closed them.

- [x] **Prototype storage has no migrations**: irrelevant now that the app has Postgres and Alembic. Closed 2026-10-31 in 8750db0.
