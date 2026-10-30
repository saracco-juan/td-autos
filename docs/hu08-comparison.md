# Compare two recommended vehicles

HU08 / RF07 / CU-07 compares current technical facts, diagnosis compatibility and existing HU10 calculator estimates. ArgAutos and calculator formula changes are out of scope.

## Manual verification

Start the backend and web app as described in [getting started](getting-started.md). Sign in as a buyer with a completed diagnosis and at least three recommendations.

| Case | Action | Expected result |
| --- | --- | --- |
| TC-23 | Select two recommendation cards, then COMPARAR. | Two aligned vehicle columns show specs, compatibility reasons and ARS purchase/monthly/yearly costs. Compare with each VER CÁLCULO COMPLETO link using the same defaults. |
| TC-24 | Select two cards, then attempt a third. | An exact-two notice appears; the original two stay selected. |
| TC-76 | Press COMPARAR with zero or one selection; also open `/comparar` directly. | Selection correction is requested and no comparison cards is shown. |
| TC-25 | In the comparison, QUITAR one vehicle, return to recommendations and select a replacement. | The cards disappear, the other ID and filters remain, and the replacement completes a new pair. |

At 1280×800, 768×1024 and 375×812, the page must not scroll horizontally; the comparison viewport itself can scroll to retain the two columns. Keyboard users can focus that viewport and scroll it. Check broken/missing images and unavailable costs: no invented prices or zero substitutes.

The comparison uses two separate named vehicle cards, matching High v3 photos, spacing and label/value alignment. Selection actions are compact, not full-width stacked buttons. Expand “Sobre la comparación y los costos” for estimate caveats; fact explanations remain available through their information buttons. Detailed facts and the existing calculator totals are retained below the overview.

Each vehicle card contains its own tabs below “Especificaciones técnicas”, like the detail screen. Use either to compare general information, engine/consumption, safety, comfort, diagnosis factors and costs. Both panels must switch together; ArrowLeft/Right wrap and Home/End activate first/last. Keyboard focus must stay in the initiating card. The selected pair and calculator totals must not change.

In recommendations, COMPARAR (QUITAR when selected) and VER FICHA must remain adjacent at desktop and mobile widths. Selecting a third still rejects it; removing one still preserves the other; VER FICHA retains its original navigation/provenance state. The vehicle-entry form and existing detail tabs are not migrated in this scope.

## Data boundaries

- Web keeps selection IDs in the route query. Mobile keeps only IDs in the buyer navigation provider, shared by recommendations, detail and comparison; signing out clears the selection. Current recommendations, public vehicle details and calculator GETs remain authoritative. No local storage or user-profile writes.
- Costs use each calculator's diagnostic/default mileage and coverage; inputs, rates date and excluded concepts are visible. Partial totals are labeled, not treated as complete estimates.
- Compatibility factors describe the buyer's diagnosis, not an absolute winner. Missing priority/equipment values are not converted to zero/false.
- Figma extensions are recorded in [design rules](design.md#hu08-vehicle-comparison-2026-10-27); synchronization requires explicit approval.

## Automated checks

From `frontend/web`: `npm run test -- src/features/comparison ../shared/comparison`, `npm run lint`, `npm run build`, and `npm run test:coverage`. From the repository root: `node scripts/check-duplication.mjs`.

## Mobile / Expo Go verification

Start the API and Expo as described in [getting started](getting-started.md#3-mobile-app).
Use the existing compatible Expo Go app, scan the QR and sign in as a buyer with a
completed diagnosis and at least three recommended vehicles. Keep the current SDK
and dependencies. Google sign-in uses the existing [development setup](development/local-environment.md#google-sign-in-from-a-phone-development-only).

| Case | Action | Expected result |
| --- | --- | --- |
| TC-23 | Select COMPARAR on two recommendation cards, then COMPARAR (2/2). | Two native cards use internal horizontal scrolling and the same facts, diagnosis factors and calculator totals as web. Both cards switch sections together. |
| TC-24 | Try selecting a third card, or open its sheet and press COMPARAR. | The original pair stays selected and an exact-two notice appears. |
| TC-76 | Open COMPARAR (0/2) or COMPARAR (1/2). | A completion message appears; no comparison or costs are loaded. |
| TC-25 | QUITAR one compared vehicle, return to recommendations and select another. | Comparison cards disappear, the other selection and applied filters remain, and the replacement creates the new pair. |

Also open COMPARAR from a vehicle sheet, follow VER CÁLCULO COMPLETO, and return
using the screen links and Android Back. Confirm vertical scrolling, horizontal
swipes, readable wrapped values, photo fallbacks and content above the bottom tab
bar. Reopening the comparison refreshes availability, details and costs. No
comparison destination is added to the five bottom navigation buttons.

Automated checks use Jest/React Native Testing Library for screen interactions,
plus lint, TypeScript and `npx expo export --platform android`. An Android bundle
export is not a native APK build or device QA. The app does not currently install
`react-native-web`; browser QA cannot replace the agreed Expo Go check.
