# ai-first-setup

## Objective

Make the repo self-sufficient for AI-first work: any session knows where the documentation lives, fetches it without asking, and runs behind guardrails.

## Problem

Documentation lives in Drive, Trello, Figma, Miro and Lucid. Their locators were shared in past conversations but never persisted in the repo, so the agent asked for access instead of fetching (HU01 frontend was built without Figma). There was no project `CLAUDE.md`, no `.claude/`, no `.mcp.json`; skills and conventions lived only in the user's global config.

## Scope

AI tooling and context files only. No product code changes.

## Constraints

- The user performs all git operations. The agent never branches, stages or commits; it hands over commands. This overrides the ODD auto-commit rule.
- `CLAUDE.md` and `.claude/settings.local.json` are local (gitignored). The teammate uses Codex.
- `README.md` owns layout, commands and branch/commit conventions; context files must not restate them.
- TDD: strict mode is enabled globally but not applicable here (no product code). Guardrails are verified by triggering them.

## Tasks

- [x] T1 — Local `CLAUDE.md` with sources of truth and git ownership rule. Route: inline. Check: locators verified live against Drive, Trello and Figma on 2026-10-01.
- [x] T2a — `.claude/settings.local.json` denying state-changing git and `gh pr create/merge`. Check: `git stash list` denied, `git status` allowed (2026-10-01).
- [ ] T2b — Decide remaining guardrails (format/lint hooks) after reviewing what gentle-ai already installs.
- [x] T2c — RDD disabled for this clone (`gentle-ai review mode disable --scope clone`). Check: status reports `off (decided by clone_local)` (2026-10-01).
- [x] T3 — Shared `AGENTS.md` (tool-neutral: sources of truth, working rules, pointer to README) + local `CLAUDE.md` importing it via `@AGENTS.md` with git ownership and review rules. Check: files written; import to be confirmed in a fresh session. `AGENTS.md` awaits the user's commit.
- [ ] T4 — Project skills: `td-autos-figma-screens` and a skill for starting a story from its Trello card.
- [ ] T5 — MCP: verify Miro and Lucid access to the DER and components diagram; authorize Supabase.
- [ ] T6 — Hygiene: `.gitignore` (`node_modules`, decide on `.atl/` and `odd/`).

## Progress

- 2026-10-01: T1 and T2a done. An initial branch and commit made by the agent were undone by the user; `.gitignore` has uncommitted additions (`/CLAUDE.md`, `/.claude/settings.local.json`).

## Next step

T4 (project skills), after the user confirms `AGENTS.md` loads in a fresh session.
