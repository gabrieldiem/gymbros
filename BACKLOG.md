# Backlog

Work that matters but isn't the current task. The `backlog` skill (`.claude/skills/backlog/SKILL.md`) describes how to add, pick up and close items.

Format: `- [ ] **Short title** (area, size S/M/L): why it matters / what done looks like. _Added YYYY-MM-DD_`

## Decide

Product or technical decisions that are still open. If one blocks work, pick the safest default, note it here, and continue.

- [ ] **Crew name** (product, S): it's still the placeholder "Iron Ridge". Is ATUS the crew name? _Added 2026-10-31_
- [ ] **Weekly event name** (product, S): English says "Leg storm", Spanish says "Leg day x2". Pick one shared name. _Added 2026-10-31_
- [ ] **Units** (product, M): kg only in v1. Add a per-user kg/lb toggle? _Added 2026-10-31_
- [ ] **Anti-cheat** (product, L): trust the crew, or require proof (photo/video for PRs, crew confirmation)? _Added 2026-10-31_
- [ ] **Hosting** (infra, M): reuse the data-service Coolify setup (webhook deploy in `deploy.yml`), or something else? Domain? _Added 2026-10-31_
- [ ] **Spanish slang** (i18n, S): Spanish rank names (Novato … Imparable) and other words the crew actually uses. _Added 2026-10-31_

## Later

- [ ] **Scoring balance pass** (game, M): a jackpot day reaches about 1,200 pts against 150 to 250 for a normal day. Simulate a month for 5 profiles and flatten it if one day decides the week. _Added 2026-10-31_
- [ ] **Bodyweight from profile** (game, S): bodyweight exercises assume an 80 kg load. Use each member's bodyweight. _Added 2026-10-31_
- [ ] **More weekly events** (game, M): only Leg day x2 exists. Add a rotating set (Pull week, Cardio week, Volume week). _Added 2026-10-31_
- [ ] **Live updates via SSE** (api+web, M): replace 20 s polling for standings, feed and "training now". _Added 2026-10-31_
- [ ] **Web push notifications** (web, M): "Maxo passed you" when the app is closed. _Added 2026-10-31_
- [ ] **Custom routines and exercises** (product, M): v1 ships a fixed catalog and four routines. _Added 2026-10-31_
- [ ] **Hero height on mobile** (web, S): the headline fills the first screen and pushes the map below the fold. _Added 2026-10-31_
- [ ] **Health app import** (product, L): Apple Health / Google Fit cardio. _Added 2026-10-31_

## Tech debt

- [ ] **Prototype is one 2,100-line file** (docs, S): `docs/prototype/index.html` is reference only. Don't extend it; port features into `apps/web`. Delete it once everything is ported. _Added 2026-10-31_
- [ ] **Prototype storage has no migrations** (docs, S): it bumps a localStorage key on every shape change. Irrelevant once the real app exists. _Added 2026-10-31_

## Done

Move items here with the date and the commit or PR that closed them.
