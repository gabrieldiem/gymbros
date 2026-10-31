---
name: backlog
description: Add, pick up, triage or close GYMBROS backlog items in Plane (project GYM), mirrored to BACKLOG.md. Use when you notice a bug, debt or idea outside the current task, when the user says "add to backlog", "later", "tech debt", "check Plane", or "pick something from the backlog / work on the backlog".
---

# Backlog

The backlog lives in **Plane**: workspace `gabrieldiem`, project **GYMBROS** (identifier `GYM`, so items are `GYM-12`). The user also submits features and bugs there directly.

`BACKLOG.md` at the repo root is the **local backup**. It holds the same items, one line each, tagged with their Plane id. Plane wins when the two disagree. Whenever you change Plane, mirror it in `BACKLOG.md` in the same commit.

## Access

- Use the `plane` MCP server (tools `mcp__plane__workitem`, `mcp__plane__label`, `mcp__plane__state`, `mcp__plane__workitem_comment`, `mcp__plane__get_pql_reference`, …). Every tool takes an `action` (`list`, `retrieve_by_identifier`, `create`, `update`, …); its description lists the parameters. Look the project id up once with `mcp__plane__project(action="list")`.
- The server is registered for this folder in local scope (stored in `~/.claude.json`, not in the repo). If it's missing, the user can re-add it with:
  `claude mcp add plane --scope local -e PLANE_API_KEY=… -e PLANE_WORKSPACE_SLUG=gabrieldiem -- uvx plane-mcp-server stdio`
- The API key is `PLANE_API_KEY` in the gitignored `.env`. Never print it, write it to a tracked file or put it in a commit, a PR or a log. If the MCP tools aren't loaded, call the REST API instead: load `.env` into the environment (`set -a; . ./.env; set +a`) and send `X-API-Key: $PLANE_API_KEY` to `https://api.plane.so/api/v1/workspaces/$PLANE_WORKSPACE_SLUG/projects/<id>/work-items/`. The limit is 60 requests a minute.

## How items are labelled

| BACKLOG.md | Plane |
|---|---|
| Section: Decide / Later / Tech debt | Label `decide` / `later` / `tech-debt` |
| Area: `api`, `web`, `game`, `product`, `infra`, `i18n`, `docs`, `design` (`api+web` means both) | One label per area |
| Size S ≤ 1 hour, M ≤ 1 day, L > 1 day | Label `size:S` / `size:M` / `size:L` |
| `- [ ]` open | State **Backlog**, or **Todo** once the user queues it, or **In Progress** while you work on it |
| `- [x]` under Done | State **Done** (or **Cancelled** when it was dropped) |

The work item's name is the short title. The description is the "why / what done looks like" text, ending with `Added YYYY-MM-DD.`

`BACKLOG.md` line format:

```markdown
- [ ] `GYM-N` **Short title** (area, size S/M/L): why it matters / what done looks like. _Added YYYY-MM-DD_
```

## Adding an item (while working on something else)

1. Don't fix it now unless it blocks the current task.
2. Create the work item in Plane: name, description, the section, area and size labels, state Backlog. Point to the file or line when it helps (`apps/api/src/services/scoring_service.py:42`).
3. Add the matching line, with the new `GYM-N`, under the right section of `BACKLOG.md`.
4. Commit it together with the current work, or alone as `Add backlog item: <title>`.
5. Mention the new item (with its id) in your end-of-step summary so the user sees it.

## Reading Plane and triaging what the user submitted

Do this at the start of any backlog work, and whenever the user says they added something in Plane.

1. List the open items (states Backlog, Todo, In Progress). Check `mcp__plane__get_pql_reference` before writing a PQL filter you aren't sure of.
2. Items with no section label came from the user. Read them, along with their comments and attachments. Add the section, area and size labels that fit. If an item is unclear, ask the user rather than guessing what they meant. Don't rewrite their text; add a comment if you have something to add.
3. Sync `BACKLOG.md` with Plane: add new items, mark closed ones as Done and update edited titles. Commit it as `Sync backlog from Plane`.

## Picking up work ("work on the backlog")

1. Read and triage Plane as above. Skip `decide` items unless the user has answered them (in a comment or in chat).
2. Pick in this order: the item the user named → items in **Todo** (queued by the user) → urgent or high priority → anything blocking a current feature → `tech-debt` + `size:S` → the oldest `later` item.
3. Say which item you're taking and why, in one line. Move it to **In Progress**. Then branch (`fix/…`, `chore/…`, `feat/…`) and work normally: plan, test, commit progressively. Mention `GYM-N` in the commit body.
4. When it's done, add a comment with the commit hash or PR and move the item to **Done**. In `BACKLOG.md`, move the line to **Done**:

   ```markdown
   - [x] `GYM-N` **Title**: closed YYYY-MM-DD in <hash or PR>.
   ```

## Closing a decision

When the user answers a `decide` item, record the answer in the right doc (`docs/PRODUCT.md`, `CLAUDE.md`, …). Comment the answer on the Plane item and move it to **Done**. Then move the line to **Done** in `BACKLOG.md`, with the answer in one line.
