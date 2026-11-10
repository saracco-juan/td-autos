# TD Autos — agent instructions

Shared instructions for any AI coding agent working in this repository (Claude Code, Codex, others). Keep this file tool-neutral: personal or tool-specific preferences belong in each developer's local, untracked files.

`README.md` is the single source for the repository layout, `docs/getting-started.md` for setup and test/lint/build commands, and `docs/contributing.md` for branch and commit conventions and CI. Read it instead of assuming; do not restate its rules here.

## Sources of truth

The project documentation lives OUTSIDE this repo. Before specifying, designing, implementing or reviewing anything, fetch the relevant source yourself with the connected tools. Never ask the user for a link or for access that is listed here, and never rely on memory of a document when the document itself can be read.

| Need | Source | Locator |
| --- | --- | --- |
| User stories (UH) and acceptance criteria, backlog status | Trello board `PSF-BACKLOG-GIARDINA-SARACCO` | https://trello.com/b/tiQ2nN2X/psf-backlog-giardina-saracco |
| Web and mobile screens (layout, copy, components) | Figma `Wireframes - TD Autos`, page `TD Autos · Wireframes High v3` only | https://www.figma.com/design/VKiAV7F3snjPJLbMrRPxjQ/Wireframes---TD-Autos?node-id=2372-7219 |
| Web requirements | Google Sheet `Requerimientos WEB - TD Autos` | https://docs.google.com/spreadsheets/d/1_unTYmivAD-yEDpvHelcsHBdb6isv44Tj98pxf2m5_0 |
| Mobile functional requirements | Google Sheet `Requerimientos funcionales Mobile - TD Autos` | https://docs.google.com/spreadsheets/d/18r_mz4NGhyQ53WvN172vjoNqsARAIB5b6n1aTdEMNQg |
| Use cases (CU) | Google Sheet `Casos de uso - TD Autos` | https://docs.google.com/spreadsheets/d/1QBfeZ0yG1FMUKzNeCoNXuBDpblcGRJJDz5Jj964_3jw |
| Test cases (TC) | Google Sheet `Casos de prueba - TD Autos` | https://docs.google.com/spreadsheets/d/15PTzskPO-GB0fI_8CC8hvbe6JJVRpVPVg4gTYqpOSEM |
| Architecture decisions | Google Doc `Diseño de Arquitectura - TD Autos` | https://docs.google.com/document/d/1Vf89jp3hCCBjyuW1N_jmN4gQLT_4b2fvFsdl9wOx56E |
| Data model (DER) | Miro board | https://miro.com/app/board/uXjVHohNqOU=/ |
| Components diagram | Lucidchart | https://lucid.app/lucidchart/7d8e135f-c838-4075-9add-b41673421d75/edit |
| Schedule | Google Sheet `Diagrama de Gantt - TD Autos` | https://docs.google.com/spreadsheets/d/1l-6iPg2nW777koChE7ebWCw8phyMFNpfjfJBZxyxNmY |
| Interviews, thesis deliverable, anything else | Drive folder `TD Autos - Saracco/Giardina` | https://drive.google.com/drive/folders/1eSpFckPMEQIvvKQKE1umBIBYYIOQSlBq |

Rules:

- Any task tied to a story (UH), requirement (RF), use case (CU) or test case (TC) starts by reading that item in its source. Quote its id in specs and tests, and reference the story in the commit footer as `docs/contributing.md` describes.
- Any web screen starts by reading its Figma node. Ignore the legacy Figma pages `TD Autos · Wireframes High v2` and `TD Autos . Wireframes Medium Web` (nodes `2141:*`).
- Only files inside the Drive folder above are valid. Files elsewhere in Drive with similar names are stale copies.
- If two sources disagree, stop and report the conflict instead of picking one. Known inconsistencies are tracked in Trello card #78.
- If a source cannot be reached (connector not authorized, no permission), say exactly which one failed and continue only with work that does not depend on it.
- If a source you need is missing from the table, ask for it once and add it here.

## Working rules

- Code, identifiers, comments and tests are written in English. User-facing copy is Spanish (Argentine voseo, sentence case, buttons in uppercase).
- Project documentation lives in `docs/`; only `README.md`, `AGENTS.md` and `CLAUDE.md` stay at the root. `README.md` is the plain-language landing page; technical content goes to `docs/`.
- Before building or changing any screen, read `docs/design.md`: it holds every visual and interaction rule (layout, responsive, lists and pagination, feedback). Add new design directives there, not here.
- Technical setup that is not in `docs/getting-started.md` (tunnels, local environment tricks, scripts and maintenance commands) lives in `docs/development/`, one file per topic, indexed by `docs/development.md`. Read only the topic file you need; add new notes to the matching topic file (or a new one listed in the index).
- Deployed environments (hosting, per-environment variables, one-time service setup, deploy troubleshooting) live in `docs/infrastructure.md`. The repository is public: write placeholders there, never real secrets, hosts' credentials or personal data.
- Logic that web and mobile both need (rules, models, pure helpers) goes to `frontend/shared` from the first commit; never copy it between the apps. Before handing over a branch, run `node scripts/check-duplication.mjs` from the repo root and fix what it reports: SonarQube Cloud fails the PR above 3% duplicated new code.
- Never read or print `backend/.env`. Use `backend/.env.example` as the reference for variables.
- Do not discard uncommitted work (`git reset --hard`, `git clean`, `git checkout -- <path>`, `git stash drop`) without explicit confirmation from the developer.

## RDD review preference

- When RDD applies, prefer "Review this change" (option 1).
- A very small, low-risk change may skip review when the applicable assessment says it is unnecessary; still run proportional checks. Small size alone does not waive security or data risks.
- Use this preference wherever the runtime supports standing consent. If the native review contract requires explicit consent for each candidate, obtain it rather than treating this preference as a grant or bypassing the contract.
- Keep RDD mode user-owned; this preference does not authorize publishing, merging, or changing that mode.

## Shared agent memory (Engram)

Agent memory travels between machines through the repo, one folder per developer: `engram/juan/` and `engram/mariano/`. Each developer writes only to their own folder.

- Run every `engram sync` from inside the folder and pass `--project td-autos` when exporting: Engram takes the project name from the current folder otherwise.
- Session start (after pulling): from your folder, `engram sync --import`.
- Session end: from your folder, `engram sync --project td-autos`, then the developer commits `engram/<name>/` with the rest of the work.
- Before handing over commit commands, run that export and include `engram/<name>/` in the commands whenever it changed, so the memory travels with the work it describes.
- The last engram export of a branch belongs to its pull request. Before the final push of a branch (and before reporting that it is ready to merge), export and commit `engram/<name>/` on that branch. If memories are saved after the pull request is open, commit and push them to the same pull request before it is merged. Never leave engram commits on a branch after its pull request is merged.
- Never leave engram changes staged, stashed or uncommitted: commit them on the branch you are working on (`chore: sync engram memories`), so a branch switch cannot strand them.
- To see the other developer's context, run `engram sync --import` from their folder, then search Engram with project `td-autos`. This copies their memories into your local database; it never writes to their folder.
- `manifest.json` is required by `engram sync --import` and grows on every branch that exports, so merges conflict on it. Register the union merge driver once per clone, from the repo root: `git config merge.engram-manifest.driver "node scripts/engram-merge-manifest.mjs %O %A %B"`. If a conflict still appears (driver not registered), resolve it by keeping every chunk entry from both sides.

## Closing a task

- Every time a task is finished, the closing message includes how to test it manually: what to start (see `docs/getting-started.md`), the steps to follow, and the expected result of each step. For a task with no visible behavior (refactor, tests only), say what to smoke-test or that there is nothing new to see.
- When the task is backend-only and has no screen yet, the manual test comes with ready-to-paste code: a self-contained snippet (browser console or terminal) that authenticates the same way the real client does, one call per case, and the expected status and body of each call. The developer should not have to write or adapt code beyond the host and port.

## Improvements backlog

- The Trello list `Mejoras/Arreglos` holds non-blocking improvements and fixes. A card is short and human, written in Spanish: a title in sentence case, without a period, that says what is wanted; a description of one to three sentences ("Hoy pasa X. Tendría que pasar Y."), plus an optional "Puede requerir…"; and its labels: one type (`Mejora` or `Arreglo`), one or two areas (`UX/UI`, `Frontend`/`Backend`, `WEB`/`MOBILE`) and one priority (`Prioridad-Alta`, `Prioridad-Media` or `Prioridad-Baja`, low by default). One card per topic; long detail goes in a comment.
- When something non-blocking is noticed while working, offer a card written to that standard instead of fixing it in place; never widen the story.
- Before starting a story, scan that list and propose the cards that belong to the code the story already touches. Apply only the ones the developer confirms, each in its own commit with the card in the footer (`Refs: Trello #127`). Skip cards that belong to another developer's story or need new requirements.
- The closing message says which cards were applied, so the developer can move them to Done after the merge.

## Screen decisions go back to Figma

- Whenever a screen ends up different from its Figma frame (something was missing, was wrong, or was changed), write the decision down when it is made: screen, Figma frame, what Figma shows, what was implemented and why.
- The last step of a story that touched a screen is to apply those decisions to the Figma file, so Figma stays the visual source of truth. Present the list of changes to the developer and wait for approval before editing Figma.
- A screen decision applies to web and mobile by default, even when the story covers one platform: the list of changes says, for each item, what happens on each platform (apply, pending because the frame does not exist yet, or not applicable with the reason). Only layout that exists on a single platform stays on that platform.
- Edit only the page `TD Autos · Wireframes High v3`. If Figma cannot be edited, report which changes are pending and add them to the Trello card that tracks Figma follow-ups.
