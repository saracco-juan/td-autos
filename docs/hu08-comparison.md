# Compare two recommended vehicles

HU08 / RF07 / CU-07 compares current technical facts, diagnosis compatibility and existing HU10 calculator estimates. ArgAutos and calculator formula changes are out of scope.

## Manual verification

Start the backend and web app as described in [getting started](getting-started.md). Sign in as a buyer with a completed diagnosis and at least three recommendations.

| Case | Action | Expected result |
| --- | --- | --- |
| TC-23 | Select two recommendation cards, then COMPARAR. | Two aligned vehicle columns show specs, compatibility reasons and ARS purchase/monthly/yearly costs. Compare with each VER CÁLCULO COMPLETO link using the same defaults. |
| TC-24 | Select two cards, then attempt a third. | An exact-two notice appears; the original two stay selected. |
| TC-76 | Press COMPARAR with zero or one selection; also open `/comparar` directly. | Selection correction is requested and no comparison table is shown. |
| TC-25 | In the comparison, QUITAR one vehicle, return to recommendations and select a replacement. | The table disappears, the other ID and filters remain, and the replacement completes a new pair. |

At 1280×800, 768×1024 and 375×812, the page must not scroll horizontally; the comparison viewport itself can scroll to retain the two columns. Keyboard users can focus that viewport and scroll it. Check broken/missing images and unavailable costs: no invented prices or zero substitutes.

## Data boundaries

- Only selection IDs live in the route query; current recommendations, public vehicle details and calculator GETs remain authoritative. No local storage or user-profile writes.
- Costs use each calculator's diagnostic/default mileage and coverage; inputs, rates date and excluded concepts are visible. Partial totals are labeled, not treated as complete estimates.
- Compatibility factors describe the buyer's diagnosis, not an absolute winner. Missing priority/equipment values are not converted to zero/false.
- Figma extensions are recorded in [design rules](design.md#hu08-vehicle-comparison-2026-10-27); synchronization requires explicit approval.

## Automated checks

From `frontend/web`: `npm run test -- src/features/comparison ../shared/comparison`, `npm run lint`, `npm run build`, and `npm run test:coverage`. From the repository root: `node scripts/check-duplication.mjs`.
