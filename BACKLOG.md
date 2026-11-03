# Backlog

Work that matters but isn't the current task. The source of truth is the **GYMBROS** project in Plane (workspace `gabrieldiem`, items `GYM-N`); this file is the local backup and mirrors it. The `backlog` skill (`.claude/skills/backlog/SKILL.md`) describes how to add, triage, pick up and close items.

Format: ``- [ ] `GYM-N` **Short title** (area, size S/M/L): why it matters / what done looks like. _Added YYYY-MM-DD_``

## Decide

Product or technical decisions that are still open. If one blocks work, pick the safest default, note it here, and continue.

- [ ] `GYM-1` **Crew name** (product, S): it's still the placeholder "Iron Ridge". Is ATUS the crew name? _Added 2026-10-31_
- [ ] `GYM-2` **Weekly event name** (product, S): English says "Leg storm", Spanish says "Leg day x2". Pick one shared name. Default chosen: "Leg day x2" in both languages (`leg_event_name`). _Added 2026-10-31_
- [ ] `GYM-3` **Units** (product, M): kg only in v1. Add a per-user kg/lb toggle? _Added 2026-10-31_
- [ ] `GYM-4` **Anti-cheat** (product, L): trust the crew, or require proof (photo/video for PRs, crew confirmation)? _Added 2026-10-31_
- [ ] `GYM-6` **Spanish slang** (i18n, S): Spanish rank names (Novato … Imparable) and other words the crew actually uses. _Added 2026-10-31_
- [ ] `GYM-10` **First log of an exercise and PR points** (game, S): default chosen: the first time you log an exercise it sets your baseline PR and pays nothing; PRODUCT.md says a PR must beat the stored one. The prototype paid 100 for it, which lets anyone farm points by logging every exercise once. _Added 2026-10-31_
- [ ] `GYM-11` **Most improved formula** (game, S): default chosen: the mean of strength change (squat/bench/deadlift e1RM vs 4 weeks ago) and volume change (last 3 weeks vs the 3 before), over whichever the member has history for. The prototype's "+18%" had no formula. _Added 2026-10-31_
- [ ] `GYM-12` **Who hears about a goal hit** (product, S): default chosen: the rest of the crew gets "X hit the weekly goal". The finisher already sees it on the finish screen. _Added 2026-10-31_
- [ ] `GYM-13` **Bounty rules** (game, S): default chosen: the bounty is always on the all-time leader and pays the first member to pass them each week. The prototype only said "while a bounty is active". _Added 2026-10-31_
- [ ] `GYM-14` **Badges earned by seeded history** (product, S): default chosen: demo members get the badges their seeded history earns, with no extra points, so the prototype's totals stay exact. _Added 2026-10-31_
- [ ] `GYM-61` **Cardio point balance** (game, S): default chosen: 2 pts per minute plus 8 per run-equivalent km, a swim km counting as 4 and a rowing km as 0.8. An hour pays 255 for a 10 km run or a 2.5 km swim, against 250 for a 12-tonne lifting session. Check it against real workouts after a few weeks. _Added 2026-11-02_
- [ ] `GYM-62` **Leg day x2 pays only lifters** (game, S): the weekly event doubles leg set points, so runners and swimmers get nothing from it. Default chosen: unchanged until more weekly events exist (GYM-17). _Added 2026-11-02_
- [ ] `GYM-69` **How past workouts score** (game, S): defaults chosen and written in `docs/PRODUCT.md`: it counts on the day picked with that week's goal, streak and quests; bounty, badges and passed stay this week's; paid bonuses and settled duels aren't redone. The risk is holding a workout back to take a duel or bounty: the feed shows the day it was for (see GYM-4). _Added 2026-11-02_
- [ ] `GYM-71` **Where uploaded pictures live** (infra, S): default chosen: in Postgres, because this stack has no file storage. They make backups larger; if crews grow, move them to object storage. The URLs already go through the API, so the web app wouldn't change. _Added 2026-11-02_
- [ ] `GYM-72` **Phone clocks decide when an offline workout happened** (game, S): default chosen: a synced workout keeps the phone's times, within a week of now, so a member could claim dawn or night badges. Same trust as past workouts (see GYM-4, GYM-69). _Added 2026-11-02_

## Later

- [ ] `GYM-89` **Update base images, packages and language versions** (infra+api+web, M): check the base Docker images, both apps' packages and the language versions, and bring them reasonably up to date. Node 22 is old, Python 3.13 is fine, and use alpine where possible to save RAM. To be done autonomously, with no input needed. Keep the no-blind-upgrades rule for Dockerfiles. _Added 2026-11-03_
- [ ] `GYM-88` **Include steps in Download my data** (api, S): the export has workouts but not step entries, and the privacy policy says you can download all your training. `models/export.py`. _Added 2026-11-03_
- [ ] `GYM-15` **Scoring balance pass** (game, M): a jackpot day reaches about 1,200 pts against 150 to 250 for a normal day. Simulate a month for 5 profiles and flatten it if one day decides the week. _Added 2026-10-31_
- [ ] `GYM-16` **Bodyweight from profile** (game, S): bodyweight exercises assume an 80 kg load. Use each member's bodyweight. _Added 2026-10-31_
- [ ] `GYM-17` **More weekly events** (game, M): only Leg day x2 exists. Add a rotating set (Pull week, Cardio week, Volume week). _Added 2026-10-31_
- [ ] `GYM-18` **Live updates via SSE** (api+web, M): replace 20 s polling for standings, feed and "training now". _Added 2026-10-31_
- [ ] `GYM-19` **Web push notifications** (web, M): "Maxo passed you" when the app is closed. _Added 2026-10-31_
- [ ] `GYM-20` **Custom routines and exercises** (product, M): v1 ships a fixed catalog and four routines. _Added 2026-10-31_
- [ ] `GYM-22` **Health app import** (product, L): Apple Health / Google Fit cardio. _Added 2026-10-31_
- [ ] `GYM-26` **Leave or switch crew** (product, S): one crew per user. An admin can remove someone from a crew in the backoffice, but members can't leave by themselves. _Added 2026-10-31_
- [ ] `GYM-31` **Climber sheet** (web, M): tapping a marker or rope row in the prototype opens a profile sheet (head to head, last workout, best lift, gap, Start a duel, Nudge). Unblocked: duels and nudges exist now. _Added 2026-10-31_
- [ ] `GYM-32` **YOU tag can overlap a marker** (web, S): on the map, the "YOU" label above your marker can touch a neighbour nudged just above it (same as the prototype). Offset the tag away from neighbours. _Added 2026-10-31_
- [ ] `GYM-33` **Climb standings query cost** (api, S): `/api/climb` runs several aggregates per poll (every 20 s per open tab). Fine for 5 people; cache per crew for a few seconds if crews grow. _Added 2026-10-31_
- [ ] `GYM-35` **Notification fan-out to the actor's camp-mates** (api, S): "someone close behind" uses a fixed 300 pt window (`social.close_behind_points`). Consider week mode too. _Added 2026-10-31_
- [ ] `GYM-36` **Delete own comment / undo nudge** (product, S): neither exists. _Added 2026-10-31_
- [ ] `GYM-38` **Weekly recap notification** (api, S): "Your weekly recap is ready" isn't sent; the recap is a card on ATUS Climb. Send it on the first request after Monday 00:00. _Added 2026-10-31_
- [ ] `GYM-39` **Duel settlement needs a visit** (api, S): duels settle when someone in the crew opens the Quests tab after the week. A small scheduled job would pay winners on Monday morning even if nobody opens it. _Added 2026-10-31_
- [ ] `GYM-40` **Event and bounty sheets** (web, S): the prototype opens a sheet from the hero chips; the app shows them as cards on the Quests tab only. _Added 2026-10-31_
- [ ] `GYM-41` **Crew palette contrast** (design, S): the dataviz validator flags the crew colors on the dark surface (lightness band; pink/violet ΔE 7.0 for deutan vision). Charts that use them always add a legend with names; consider a darker violet step. _Added 2026-10-31_
- [ ] `GYM-42` **Tonnage chart y-axis** (web, S): only this week's bar is labelled (the rest via tooltip and table). Add light y ticks if people ask for exact values at a glance. _Added 2026-10-31_
- [ ] `GYM-56` **Split the JS bundle per tab** (web, S): the build is one 426 KB JS chunk (132 KB gzipped). Lazy-load each tab's route so the first paint only parses Climb; check the precache size and e2e after. _Added 2026-10-31_
- [ ] `GYM-60` **Blue/green deploys with no downtime** (infra, M): a version that passes the smoke test but fails in production causes an outage until the previous one is restored, up to a few minutes. Start the new version beside the old one and switch Caddy only once it is healthy. Needs room on the box for both. _Added 2026-11-01_
- [ ] `GYM-64` **Cardio is missing from the You tab and most improved** (game+web, M): points are fair across sports, but the stats read lifts and tonnage only, and feed posts show minutes but not distance. Someone who only runs or swims sees empty stats and can't win most improved. _Added 2026-11-02_
- [ ] `GYM-66` **Moderate comments in the backoffice** (product, S): admins can delete an account but not a single comment. Workout photos need the same: only their owner can remove one. Add it, with an audit log entry. _Added 2026-11-02_

## Tech debt

- [ ] `GYM-74` **API access log keeps Google sign-in codes** (api+infra, S): uvicorn logs the query string, so `/api/auth/google/callback` puts Google's one-time code and the state in the prod logs. Low risk (single use, needs the secret and PKCE verifier), but they shouldn't be kept. _Added 2026-11-02_
- [ ] `GYM-73` **nginx drops security headers on the app shell** (infra, S): `add_header` in a location replaces the server-level ones, so `index.html`, `sw.js` and SPA paths have no `X-Frame-Options` or `Referrer-Policy` (checked on prod). The app can currently be framed. `apps/web/nginx.conf`. _Added 2026-11-02_
- [ ] `GYM-43` **Prototype is one 2,100-line file** (docs, S): `docs/prototype/index.html` is reference only. Don't extend it; port features into `apps/web`. Delete it once everything is ported. _Added 2026-10-31_
- [ ] `GYM-44` **Node 22.22+ for latest web deps** (web, S): React Router 8 and jsdom 30 need Node ≥22.22. The local machine runs 22.17, so the web app pins React Router 7.18 and jsdom 29. Upgrade Node, then bump both. _Added 2026-10-31_
- [ ] `GYM-45` **ESLint toolchain audit warning** (web, S): `npm audit` reports a moderate minimatch advisory inside ESLint/typescript-eslint (dev-only, not shipped). Clear it when upstream releases a fix. _Added 2026-10-31_
- [ ] `GYM-49` **Pylint inference on table modules** (api, S): `db/tables/workout.py` and `workout_set.py` disable `unsubscriptable-object` because astroid mis-infers `Mapped` in a full run. Remove when astroid fixes it. _Added 2026-10-31_
- [ ] `GYM-53` **Drop the targeted apk upgrade in the web image** (infra, S): `apps/web/Dockerfile` upgrades `brotli-libs`, `curl` and `libcurl` on top of `nginx:1.30-alpine` (CVE-2026-111497 was CRITICAL and failed the deploy scan). Remove that line once a newer `nginx:1.30-alpine` ships brotli-libs ≥ 1.2.1-r0 and curl ≥ 8.23.0. _Added 2026-10-31_
- [ ] `GYM-59` **Drop users.password_hash** (api, S): nothing reads it since Google sign-in. It stays nullable for one release so the migration can be rolled back; drop it once Google sign-in has worked in production, as it still holds old argon2 hashes. _Added 2026-11-01_
- [ ] `GYM-68` **Cap how long server logs are kept** (infra, S): Docker logs are capped at 30 MB per service. Still to do: check what Caddy keeps on the host, then state the real retention period in the privacy policy. _Added 2026-11-02_

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
- [x] `GYM-37` **Old notifications cleanup**: marking the inbox read deletes your notifications older than `social.notification_days` (60). Closed 2026-10-31 on chore/backlog-tech-debt.
- [x] `GYM-23` **Login rate limiting**: no longer applies: the password endpoints are gone and Google handles credentials. Cancelled 2026-11-01 on feat/google-auth.
- [x] `GYM-24` **Password reset**: no longer applies: there are no passwords to reset. Cancelled 2026-11-01 on feat/google-auth.
- [x] `GYM-57` **Feed says "Tú desbloqueó" for your own badge**: your own badge and rank posts read in second person. Closed 2026-11-02 on feat/motion-menu.
- [x] `GYM-8` **Who creates a crew**: crews can be created in the app from the backoffice; `make crew` still works. Closed 2026-11-02 on feat/invites.
- [x] `GYM-5` **Hosting**: answered by the deploy setup: Portainer on Lightsail at gymbros.gabrieldiem.com. Closed 2026-11-02.
- [x] `GYM-7` **Production migrations**: the default stands: the api image migrates when it starts. Closed 2026-11-02.
- [x] `GYM-9` **Crew time zone**: no longer a decision: each crew's time zone is set in the backoffice. Closed 2026-11-02.
- [x] `GYM-21` **Hero height on mobile**: no longer true: at 390×844 the map starts at y=319, with 451 px visible. Cancelled 2026-11-02.
- [x] `GYM-30` **Prototype: first-time PR**: duplicate of GYM-10. Cancelled 2026-11-02.
- [x] `GYM-67` **Legal pages still say badges**: closed 2026-11-02 in 6748084.
- [x] `GYM-63` **App stays on the old version after a deploy**: closed 2026-11-02 in c9ddaf5.
- [x] `GYM-34` **Reply notifications for commenters**: closed 2026-11-02 in 55637b1.
- [x] `GYM-65` **Point adjustments are silent**: closed 2026-11-02 in 55637b1.
- [x] `GYM-27` **Show the current PR in the logger**: closed 2026-11-02 in d95005a.
- [x] `GYM-29` **Offline logging**: closed 2026-11-02 in f48399e.
- [x] `GYM-58` **Which emails should GYMBROS send**: answered 2026-11-02: welcome, weekly digest and messages from admins, in 06a8909.
- [x] `GYM-70` **Skipped exercises wipe last time and the pre-fill**: closed 2026-11-02 in d32999d.
- [x] `GYM-75` **Log steps by day or period, with a calendar and a steps climb**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-76` **Muay Thai and other timed sports**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-77` **Log a set with no weight**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-78` **Add the exercises a member couldn't find**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-79` **Custom exercises by name, with no points**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-80` **Cancel a workout from the banner**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-81` **React with any emoji on posts and comments**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-82` **Answer a post with an image**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-83` **Strip metadata from every uploaded image and give it a standard name**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-84` **Colour picker from a package, showing a custom colour**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-85` **Edited tag last, showing what changed**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-86` **Don't name who runs GYMBROS in the legal pages**: closed 2026-11-03 on feat/steps (f770543).
- [x] `GYM-87` **Adjustable width for backoffice columns**: closed 2026-11-03 on feat/steps (f770543).
