---
name: backlog
description: Add, pick up, or close items in BACKLOG.md. Use when you notice a bug, debt or idea outside the current task, when the user says "add to backlog", "later", "tech debt", or "pick something from the backlog / work on the backlog".
---

# Backlog

`BACKLOG.md` at the repo root is the single list of later work. It is tracked in git so it moves with the code.

## Sections

- **Decide**: open product or technical decisions. Never decide these silently. If one blocks you, pick the safest default, write which default you chose on the item, and continue.
- **Later**: features and improvements.
- **Tech debt**: code that works but will cost us (shortcuts, missing tests, duplication, outdated deps).
- **Done**: closed items with the date and commit hash or PR.

## Adding an item (while working on something else)

1. Don't fix it now unless it blocks the current task.
2. Add one line under the right section:
   `- [ ] **Short title** (area, size S/M/L): why it matters / what done looks like. _Added YYYY-MM-DD_`
   - area: `api`, `web`, `game`, `product`, `infra`, `i18n`, `docs`
   - size: S ≤ 1 hour, M ≤ 1 day, L > 1 day
   - Point to the file or line when it helps (`apps/api/src/services/scoring_service.py:42`).
3. Commit it together with the current work, or alone as `Add backlog item: <title>`.
4. Mention the new item in your end-of-step summary so the user sees it.

## Picking up work ("work on the backlog")

1. Read `BACKLOG.md`. Skip **Decide** items unless the user answered them.
2. Prefer, in order: items the user named → anything blocking a current feature → tech debt marked S → the oldest Later item.
3. Say which item you're taking and why, in one line. Then branch (`fix/…`, `chore/…`, `feat/…`) and work normally: plan, test, commit progressively.
4. When it's done, move the line to **Done**: `- [x] **Title**: closed YYYY-MM-DD in <hash or PR>`.

## Closing a decision

When the user answers a **Decide** item, record the answer in the right doc (`docs/PRODUCT.md`, `CLAUDE.md`, …), then move the item to **Done** with the answer in one line.
