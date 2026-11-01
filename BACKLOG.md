# Backlog

Work that matters but isn't the current task. The source of truth is the **GYMBROS** project in Plane (workspace `gabrieldiem`, items `GYM-N`); this file is the local backup and mirrors it. The `backlog` skill (`.claude/skills/backlog/SKILL.md`) describes how to add, triage, pick up and close items.

Format: ``- [ ] `GYM-N` **Short title** (area, size S/M/L): why it matters / what done looks like. _Added YYYY-MM-DD_``

## Decide

Product or technical decisions that are still open. If one blocks work, pick the safest default, note it here, and continue.

- [ ] `GYM-1` **Crew name** (product, S): it's still the placeholder "Iron Ridge". Is ATUS the crew name? _Added 2026-10-31_
- [ ] `GYM-2` **Weekly event name** (product, S): English says "Leg storm", Spanish says "Leg day x2". Pick one shared name. Default chosen: "Leg day x2" in both languages (`leg_event_name`). _Added 2026-10-31_
- [ ] `GYM-3` **Units** (product, M): kg only in v1. Add a per-user kg/lb toggle? _Added 2026-10-31_
- [ ] `GYM-4` **Anti-cheat** (product, L): trust the crew, or require proof (photo/video for PRs, crew confirmation)? _Added 2026-10-31_
- [ ] `GYM-5` **Hosting** (infra, M): where does GYMBROS run, and on which domain? `deploy.yml` has a placeholder `deploy` job (tests and the image scan still run on main); the data-service Coolify webhook flow is in its git history if that's the choice. _Added 2026-10-31_
- [ ] `GYM-6` **Spanish slang** (i18n, S): Spanish rank names (Novato … Imparable) and other words the crew actually uses. _Added 2026-10-31_
- [ ] `GYM-7` **Production migrations** (infra, S): default chosen: the api image runs `alembic upgrade head` before starting the workers, so a deploy migrates itself. Alternative: a separate one-off migrate job on the hosting platform. _Added 2026-10-31_
- [ ] `GYM-8` **Who creates a crew** (product, S): default chosen: crews are created by an operator with `make crew` (CLI) and shared by invite code; there is no in-app "create crew". Add an in-app flow if the app should onboard other groups. _Added 2026-10-31_
- [ ] `GYM-9` **Crew time zone** (product, S): default chosen: the demo crew uses `America/Argentina/Buenos_Aires`. Confirm the real crew's zone (weeks reset Monday 00:00 there). _Added 2026-10-31_
- [ ] `GYM-10` **First log of an exercise and PR points** (game, S): default chosen: the first time you log an exercise it sets your baseline PR and pays nothing; PRODUCT.md says a PR must beat the stored one. The prototype paid 100 for it, which lets anyone farm points by logging every exercise once. _Added 2026-10-31_
- [ ] `GYM-11` **Most improved formula** (game, S): default chosen: the mean of strength change (squat/bench/deadlift e1RM vs 4 weeks ago) and volume change (last 3 weeks vs the 3 before), over whichever the member has history for. The prototype's "+18%" had no formula. _Added 2026-10-31_
- [ ] `GYM-12` **Who hears about a goal hit** (product, S): default chosen: the rest of the crew gets "X hit the weekly goal". The finisher already sees it on the finish screen. _Added 2026-10-31_
- [ ] `GYM-13` **Bounty rules** (game, S): default chosen: the bounty is always on the all-time leader and pays the first member to pass them each week. The prototype only said "while a bounty is active". _Added 2026-10-31_
- [ ] `GYM-14` **Badges earned by seeded history** (product, S): default chosen: demo members get the badges their seeded history earns, with no extra points, so the prototype's totals stay exact. _Added 2026-10-31_

## Later

- [ ] `GYM-15` **Scoring balance pass** (game, M): a jackpot day reaches about 1,200 pts against 150 to 250 for a normal day. Simulate a month for 5 profiles and flatten it if one day decides the week. _Added 2026-10-31_
- [ ] `GYM-16` **Bodyweight from profile** (game, S): bodyweight exercises assume an 80 kg load. Use each member's bodyweight. _Added 2026-10-31_
- [ ] `GYM-17` **More weekly events** (game, M): only Leg day x2 exists. Add a rotating set (Pull week, Cardio week, Volume week). _Added 2026-10-31_
- [ ] `GYM-18` **Live updates via SSE** (api+web, M): replace 20 s polling for standings, feed and "training now". _Added 2026-10-31_
- [ ] `GYM-19` **Web push notifications** (web, M): "Maxo passed you" when the app is closed. _Added 2026-10-31_
- [ ] `GYM-20` **Custom routines and exercises** (product, M): v1 ships a fixed catalog and four routines. _Added 2026-10-31_
- [ ] `GYM-21` **Hero height on mobile** (web, S): the headline fills the first screen and pushes the map below the fold. _Added 2026-10-31_
- [ ] `GYM-22` **Health app import** (product, L): Apple Health / Google Fit cardio. _Added 2026-10-31_
- [ ] `GYM-23` **Login rate limiting** (api, S): `/api/auth/login` and `/register` have no throttle. Add a per-IP and per-email limit before the app is public. _Added 2026-10-31_
- [ ] `GYM-24` **Password reset** (product, M): there is no email client, so a forgotten password needs an operator. Add reset by email or an operator CLI command. _Added 2026-10-31_
- [ ] `GYM-26` **Leave or switch crew** (product, S): one crew per user and no way to leave. Needed if someone joins the wrong crew. _Added 2026-10-31_
- [ ] `GYM-27` **Show the current PR in the logger** (web, S): the prototype shows "PR 92.5 kg × 5" next to each exercise and in the picker. Needs a PRs endpoint (Phase 5 builds one for the profile). _Added 2026-10-31_
- [ ] `GYM-29` **Offline logging** (web, M): the logger retries saves while offline, but a reload loses unsaved edits. Persist the draft locally until the server confirms it. _Added 2026-10-31_
- [ ] `GYM-30` **Prototype: first-time PR** (docs, S): the prototype awards 100 pts for the first log of an exercise; the app does not (see Decide). Note it if the prototype is kept. _Added 2026-10-31_
- [ ] `GYM-31` **Climber sheet** (web, M): tapping a marker or rope row in the prototype opens a profile sheet (head to head, last workout, best lift, gap, Start a duel, Nudge). Duels and nudges arrive in Phases 4–5; build the sheet then. _Added 2026-10-31_
- [ ] `GYM-32` **YOU tag can overlap a marker** (web, S): on the map, the "YOU" label above your marker can touch a neighbour nudged just above it (same as the prototype). Offset the tag away from neighbours. _Added 2026-10-31_
- [ ] `GYM-33` **Climb standings query cost** (api, S): `/api/climb` runs several aggregates per poll (every 20 s per open tab). Fine for 5 people; cache per crew for a few seconds if crews grow. _Added 2026-10-31_
- [ ] `GYM-34` **Reply notifications for commenters** (api, S): only the post's owner is notified of new comments; others in the thread aren't (the prototype's "replied to your comment"). _Added 2026-10-31_
- [ ] `GYM-35` **Notification fan-out to the actor's camp-mates** (api, S): "someone close behind" uses a fixed 300 pt window (`social.close_behind_points`). Consider week mode too. _Added 2026-10-31_
- [ ] `GYM-36` **Delete own comment / undo nudge** (product, S): neither exists. _Added 2026-10-31_
- [ ] `GYM-37` **Old notifications cleanup** (api, S): notifications are never deleted; the inbox shows the newest 30. Prune after 60 days. _Added 2026-10-31_
- [ ] `GYM-38` **Weekly recap notification** (api, S): "Your weekly recap is ready" isn't sent; the recap is a card on ATUS Climb. Send it on the first request after Monday 00:00. _Added 2026-10-31_
- [ ] `GYM-39` **Duel settlement needs a visit** (api, S): duels settle when someone in the crew opens the Quests tab after the week. A small scheduled job would pay winners on Monday morning even if nobody opens it. _Added 2026-10-31_
- [ ] `GYM-40` **Event and bounty sheets** (web, S): the prototype opens a sheet from the hero chips; the app shows them as cards on the Quests tab only. _Added 2026-10-31_
- [ ] `GYM-41` **Crew palette contrast** (design, S): the dataviz validator flags the crew colors on the dark surface (lightness band; pink/violet ΔE 7.0 for deutan vision). Charts that use them always add a legend with names; consider a darker violet step. _Added 2026-10-31_
- [ ] `GYM-42` **Tonnage chart y-axis** (web, S): only this week's bar is labelled (the rest via tooltip and table). Add light y ticks if people ask for exact values at a glance. _Added 2026-10-31_
- [ ] `GYM-56` **Split the JS bundle per tab** (web, S): the build is one 426 KB JS chunk (132 KB gzipped). Lazy-load each tab's route so the first paint only parses Climb; check the precache size and e2e after. _Added 2026-10-31_

## Tech debt

- [ ] `GYM-43` **Prototype is one 2,100-line file** (docs, S): `docs/prototype/index.html` is reference only. Don't extend it; port features into `apps/web`. Delete it once everything is ported. _Added 2026-10-31_
- [ ] `GYM-44` **Node 22.22+ for latest web deps** (web, S): React Router 8 and jsdom 30 need Node ≥22.22. The local machine runs 22.17, so the web app pins React Router 7.18 and jsdom 29. Upgrade Node, then bump both. _Added 2026-10-31_
- [ ] `GYM-45` **ESLint toolchain audit warning** (web, S): `npm audit` reports a moderate minimatch advisory inside ESLint/typescript-eslint (dev-only, not shipped). Clear it when upstream releases a fix. _Added 2026-10-31_
- [ ] `GYM-49` **Pylint inference on table modules** (api, S): `db/tables/workout.py` and `workout_set.py` disable `unsubscriptable-object` because astroid mis-infers `Mapped` in a full run. Remove when astroid fixes it. _Added 2026-10-31_
- [ ] `GYM-53` **Drop the targeted apk upgrade in the web image** (infra, S): `apps/web/Dockerfile` upgrades `brotli-libs`, `curl` and `libcurl` on top of `nginx:1.30-alpine` (CVE-2026-111497 was CRITICAL and failed the deploy scan). Remove that line once a newer `nginx:1.30-alpine` ships brotli-libs ≥ 1.2.1-r0 and curl ≥ 8.23.0. _Added 2026-10-31_

## Done

Move items here with the date and the commit or PR that closed them.

- [x] `GYM-55` **Prototype storage has no migrations**: irrelevant now that the app has Postgres and Alembic. Closed 2026-10-31 in 8750db0.
- [x] `GYM-28` **Rest timer length setting**: already built in Phase 5 (rest time in the You tab settings). Closed 2026-10-31 in 2b4477b.
- [x] `GYM-46` **Poetry hangs on keyring in headless shells**: `make install` runs Poetry with the null keyring backend. Closed 2026-10-31 on chore/backlog-tech-debt.
- [x] `GYM-50` **Bonus lock has no concurrency test**: `tests/test_bonus_lock.py` races two committed finishes; the second waits on the lock and the crew quest pays once. Closed 2026-10-31 on chore/backlog-tech-debt.
- [x] `GYM-52` **Precache size**: the service worker precaches only the latin font subset (815 → 662 KiB, 35 → 21 entries). Closed 2026-10-31 on chore/backlog-tech-debt.
- [x] `GYM-54` **pip-vendored HIGHs in the api image**: the runtime image has no pip (venv built with `no-pip`, base pip uninstalled); Trivy HIGHs 49 → 44, all Debian base. Closed 2026-10-31 on chore/backlog-tech-debt.
- [x] `GYM-47` **E2E depends on the demo seed**: `make e2e` rebuilds one e2e crew per viewport (`cli.py seed-e2e`) and each spec logs in as its own member. Closed 2026-10-31 on chore/backlog-tech-debt.
- [x] `GYM-48` **E2E logs real workouts**: `make e2e` rebuilds one e2e crew per viewport (`cli.py seed-e2e`) and each spec logs in as its own member. Closed 2026-10-31 on chore/backlog-tech-debt.
- [x] `GYM-51` **E2E specs share demo members**: `make e2e` rebuilds one e2e crew per viewport (`cli.py seed-e2e`) and each spec logs in as its own member. Closed 2026-10-31 on chore/backlog-tech-debt.
- [x] `GYM-25` **Expired session cleanup**: every login and sign-up deletes expired `auth_sessions` rows. Closed 2026-10-31 on chore/backlog-tech-debt.
