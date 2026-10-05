# TD Autos — agent instructions

Shared instructions for any AI coding agent working in this repository (Claude Code, Codex, others). Keep this file tool-neutral: personal or tool-specific preferences belong in each developer's local, untracked files.

`README.md` is the single source for the repository layout, setup, test/lint/build commands, and branch and commit conventions. Read it instead of assuming; do not restate its rules here.

## Sources of truth

The project documentation lives OUTSIDE this repo. Before specifying, designing, implementing or reviewing anything, fetch the relevant source yourself with the connected tools. Never ask the user for a link or for access that is listed here, and never rely on memory of a document when the document itself can be read.

| Need | Source | Locator |
| --- | --- | --- |
| User stories (UH) and acceptance criteria, backlog status | Trello board `PSF-BACKLOG-GIARDINA-SARACCO` | https://trello.com/b/tiQ2nN2X/psf-backlog-giardina-saracco |
| Web screens (layout, copy, components) | Figma `Wireframes - TD Autos`, page `TD Autos · Wireframes High v2` only | https://www.figma.com/design/VKiAV7F3snjPJLbMrRPxjQ/Wireframes---TD-Autos?node-id=38-44 |
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

- Any task tied to a story (UH), requirement (RF), use case (CU) or test case (TC) starts by reading that item in its source. Quote its id in specs and tests, and reference the story in the commit footer as `README.md` describes.
- Any web screen starts by reading its Figma node. Ignore the legacy Figma page `TD Autos . Wireframes Medium Web` (nodes `2141:*`).
- Only files inside the Drive folder above are valid. Files elsewhere in Drive with similar names are stale copies.
- If two sources disagree, stop and report the conflict instead of picking one. Known inconsistencies are tracked in Trello card #78.
- If a source cannot be reached (connector not authorized, no permission), say exactly which one failed and continue only with work that does not depend on it.
- If a source you need is missing from the table, ask for it once and add it here.

## Working rules

- Code, identifiers, comments and tests are written in English. User-facing copy is Spanish (Argentine voseo, sentence case, buttons in uppercase).
- Never read or print `backend/.env`. Use `backend/.env.example` as the reference for variables.
- Do not discard uncommitted work (`git reset --hard`, `git clean`, `git checkout -- <path>`, `git stash drop`) without explicit confirmation from the developer.

## Closing a task

- Every time a task is finished, the closing message includes how to test it manually: what to start (see `README.md`), the steps to follow, and the expected result of each step. For a task with no visible behavior (refactor, tests only), say what to smoke-test or that there is nothing new to see.

## Screen decisions go back to Figma

- Whenever a screen ends up different from its Figma frame (something was missing, was wrong, or was changed), write the decision down when it is made: screen, Figma frame, what Figma shows, what was implemented and why.
- The last step of a story that touched a screen is to apply those decisions to the Figma file, so Figma stays the visual source of truth. Present the list of changes to the developer and wait for approval before editing Figma.
- Edit only the page `TD Autos · Wireframes High v2`. If Figma cannot be edited, report which changes are pending and add them to the Trello card that tracks Figma follow-ups.
