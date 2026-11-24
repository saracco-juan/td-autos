# Figma High V4 handoff

## Location and scope

- File: [Wireframes — TD Autos](https://www.figma.com/design/VKiAV7F3snjPJLbMrRPxjQ/Wireframes---TD-Autos?node-id=2554-2).
- New page: `TD Autos · Wireframes High v4`, node `2554:2`.
- Implementation reference used for the wireframes: `develop` at `81e9a4c`.
- The user explicitly requested a new V4 covering the redesigned web and native mobile interfaces, following the existing component-based organization.
- Earlier Medium, High, High V2 and High V3 pages were preserved. No application code was changed by this Figma task.

## Delivered structure

The final structural readback confirmed 66 principal screen frames, 42 reusable components and 933 instances. A separate feedback board documents representative states. Text, vectors, component instances and auto-layout remain editable; screens are not flattened screenshots.

| Section | Node | Contents |
| --- | --- | --- |
| Mobile / Access | `2569:2345` | 3 screens |
| Mobile / Buyer | `2569:2346` | 22 screens |
| Web / Access | `2569:2347` | 8 screens |
| Web / Buyer | `2569:2348` | 18 screens |
| Web / Dealership | `2569:2349` | 11 screens |
| Web / Administration | `2569:2350` | 4 screens |
| States and feedback | `2569:2351` | Success, error and confirmation examples |

The component area is `2556:16`. A separate `TD Autos V4` Light variable collection preserves the earlier versions' tokens. The visual foundation uses Archivo, white surfaces, charcoal, TD red and green success/contact accents.

## Platform distinctions retained

- Native mobile covers buyers and access, not dealership or administrator workflows.
- Mobile recommendations use a continuous two-column catalog; web retains its grid and pagination. Mobile favorites use full-width cards.
- Mobile comparison uses `Cambiar`; web retains its existing removal action.
- Mobile checklists use accordions; web uses lateral step navigation and an active panel.
- Web registration puts the red companion panel on the left and the form on the right; login reverses that arrangement.
- Mobile navigation uses the floating graphite pill with a raised selected icon. Contact actions use green.
- Current web depreciation uses a straight charcoal line. The inspected mobile source uses a red chart and compact horizon choices; source inspection corrected an earlier assumption that the current selector was underline-only.

## Verification and limits

Section composition screenshots and selected detailed screen screenshots were inspected. Corrections included control heights, card actions, registration-panel placement, guest navigation, contact color, comparison alignment and clipped projected values. An intermediate structural audit found Archivo on all 1,420 text layers and no main-content overflow; subsequent local corrections were visually checked.

These are representative static wireframes, not a pixel-exact capture or an exhaustive inventory of runtime states. Names, prices and metrics are illustrative. Vehicle galleries deliberately show the `Sin fotos` state. Animation behavior is documented, not implemented as interactive Figma prototype transitions. No live functional, keyboard, reduced-motion or browser responsive QA is claimed.

The repository's existing `AGENTS.md` still names High V3 as the default design source. Creating V4 did not silently change that repository-wide policy; confirm the authoritative version before future implementation work.

## Memory status and continuation

This Markdown handoff is versioned repository context, following the existing handoff-file pattern in this folder. It is not an Engram observation or a generated `.engram` export and is not imported by `engram sync --import`.

The host did not provide an authoritative registered runtime identity, so attributed Engram writes were not attempted. Once that registration is restored, search the project's existing Figma V4 memories, save or update this bounded topic without duplication, then export from `engram/mariano` with `engram sync --project td-autos` and commit the resulting export under the normal repository workflow. Do not invent a session identity or manually manufacture chunks or manifests.

To inspect the deliverable manually, open the page link above and review the seven sections, then inspect a card instance and its main component. For future refinements, verify current application source and the selected Figma node before editing; preserve the previous-version pages.
