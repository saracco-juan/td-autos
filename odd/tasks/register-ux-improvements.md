# Register UX improvements

## Objective
Polish the web register screen (`/registro`) with usability improvements and the Figma "Wireframes Medium Web" header (node `2141:778`).

## Scope
- T1 Live password checklist: every requirement is always listed with a gray check that turns green when met.
- T2 Show/hide password toggle (eye icon) on both password fields.
- T3 Loading state on submit: button disabled and labelled "CREANDO CUENTA…".
- T4 Google "G" logo in the Google button.
- T5 Browser autocomplete (`name`, `email`, `new-password`) — already present, covered by a test.
- T6 Boxed "TD AUTOS" wordmark and new subtitle from Figma `2141:779` / `2141:784` (voseo adaptation).

## Constraints
- TDD: strict (session config), runner `npm test` (vitest) in `frontend/web`.
- Keep existing tests green; server-side password errors still render under the field.
- Route: direct inline (single feature folder, already understood).

## Checklist
- [x] T1–T6 implemented with tests (RED observed: 5 failing, then GREEN)
- [x] `vitest run` 57/57, `eslint .` clean, `tsc -b` clean
- [x] Visual check at 1280px: boxed wordmark, checklist states, eye toggle, 18px Google G

## Progress
- Started 2026-09-30. Done in one work-unit commit (see git log `feat(web): register ux`).
- Copy conflict: Figma subtitle uses tuteo ("introduce"); adapted to voseo "introducí" per project rule.
- New token `--status-success` (#1e7f45) — not yet in Figma variables.
