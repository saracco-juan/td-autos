# HU05 handoff for Juan

## Status

HU05's authorized web and backend implementation is complete locally, including resale ranking. The mobile recommendation screen is not covered by this completion claim. No deployment, push, merge, production migration, or host scheduler installation was performed.

- Branch: `feature/uh-5-matching-13d-resale-ranking`
- HEAD: `123698bad02edcba1f9862e02ae44aec5e5656c9`
- Stage 13d: 319 authored lines against `bd52ca660aafda3b46fb3d2e81b38cf5befca8d1`.
- Verified: 1,202 backend tests / 14,257 assertions; 1,236 web tests; lint/build; responsive checks; Judgment Day and four native ODD reviews approved.
- Native review is closed and acknowledged (Engram observation 1788). Never replay historical review commands.

## Pending: sync resale copy to Figma

The user approved the full copy and the minimum necessary card-height adjustment. The first text write was rejected with `Can't set characters in read-only mode`. Readback confirmed **no Figma changes were applied**. Resume only after edit access is available; do not bypass permissions.

- File: [Wireframes — TD Autos](https://www.figma.com/design/VKiAV7F3snjPJLbMrRPxjQ/Wireframes---TD-Autos?node-id=2372-7219).
- Edit only page **TD Autos · Wireframes High v3**, `2372:7219`.
- Desktop frame `2373:7328`: cards `2373:7340`, `2373:7341`.
- Mobile frame `2373:9914`: cards `2373:9923`, `2373:9924`.
- Existing Meta text IDs: `I<card-id>;2373:6981`.
- Copy source: `frontend/web/src/features/recommendations/MatchingVehicleCard.tsx`.

Required content: the complete missing-evidence notice and ten-point deduction explanation; stale last-valid notice; `Prioridad: no disponible`; DNRPA activity window and ACARA reference date; 50/50 priority weights; and no guaranteed future-price claim. Fixture scores/dates are illustrative, not verified market data.

Cards and the desktop row already hug height. Preserve their width, typography, spacing, images, controls, and shared component `2373:6977`. The fixed grid `2373:7338` and mobile list `2373:9922` may need minimal vertical prototype scrolling to access taller cards; preserve viewport bounds. Do not detach instances, edit the shared library, create pages, or redesign unrelated search/catalog elements.

Load each text node's actual fonts before editing. Return changed IDs, read back all four texts/heights, compare unrelated content/styles, and visually verify desktop/mobile for clipping and overlap. Do not mark the sync complete until writes and checks succeed.

## Recover the shared memory

From `engram/mariano`, run `engram sync --import`, then search project `td-autos` for `design/hu05-resale-figma-sync` and `handoff/juan/hu05-figma-pending`. Exported chunks are under this folder's `.engram/`. This handoff and export are local until the developer shares/commits them.


## Local runtime repair and browser validation — 2026-10-22

- Recommendations500 reproduced: missing `dnrpa_refresh_state` in local `backend/database/manual.sqlite`.
- User authorized backup and only `2026_10_21_000003_create_dnrpa_activity_history.php`; applied successfully. Backup and integrity/preservation proof: `../../../output/hu05-live-e2e-20261022-aa670709/` (relative to repository root: `../output/...`). Independent read-only verifier PASS;139cars/all original data preserved at migration boundary.
- Real browser checks passed: demo login,7-step diagnosis,edit/save,all4priorities,pagination,attributes/motives,automatic filter,reload persistence andempty results. No added cars needed;139unchanged. Personal diagnoses unchanged; only demo buyer answers were exercised.
- Resale currently returns explicitly-labeled partial compatibility; DNRPA tables have no evidence rows. Resolved below: real source initialization and browser scoring were subsequently verified. No source change,commit,push orpublication. Figma pending remains unchanged.

## Resolved source initialization and logarithmic activity — 2026-10-22

- Loaded 7,390 real ACARA catalog rows dated 2026-10-19 and DNRPA aggregates for April–September 2026: 939,532 transfers and 426 identified groups. Only aggregate provenance is retained, not holder data.
- Fixed real Guzzle response/sink ownership during download. The RED/GREEN regression and 1,203 backend tests passed before the scoring change. The 36-line fix is local commit `0efc604` on stage 13d; nothing was pushed.
- An independent data verifier confirmed preservation of all original 139 vehicles and other domain records. UI-created test listings 140 (automatic Versa) and 141 (manual Etios) have catalog-exact versions, placeholder images, and explicitly synthetic equipment.
- The user approved continuous activity scoring: `100 * log1p(transfers) / log1p(maximum transfers)`. Current reads recalculate from retained transfer counts; archived payloads remain byte-identical. The stage 13e branch is `feature/uh-5-matching-13e-resale-log-score`; its 89-line, six-path change remains uncommitted.
- Real activity scores: Hilux 100; Etios 90.2531; Versa 70.3532. Actual browser checks show Versa resale priority 77.9 / compatibility 90, and Etios resale priority 88 / compatibility 92.7. The personal diagnosis was not changed.
- Verification: 133 resale tests / 462 assertions, 10 endpoint tests / 120 assertions, and the full 1,205-test backend suite / 14,271 assertions passed. The initial native assessment was medium and under budget; the user subsequently requested explicit reviews, completed below.
- After browser checks, all 141 vehicle rows, domain tables, DNRPA payloads, schema and migrations match the pre-change backup. Only the expected demo logout token changed; session/cache activity is operational.
- Other synthetic version labels that do not match the catalog remain explicitly partial. No fuzzy mappings were invented. Figma work remains pending; nothing was deleted or published.
- Backups and screenshots are in the repository parent's `output/hu05-source-load-20261022/` and `output/hu05-log-score-20261022/` folders.

## Logarithmic scoring reviews — completed 2026-10-22

- Judgment Day: two blind judges, both with zero findings; approved without corrections.
- Explicit native reviews: risk, resilience, readability, and reliability all completed with zero findings. The exact final acknowledgement confirmed closure and consumed the review authority.
- Scope: the same immutable 89-line, six-path candidate; no source or application-data changes during review. A focused parent regression check passed (2 tests, 9 assertions).
- The first launch was blocked by local reviewer-state permissions. After the bound workflow reoffered the same slots, approved per-command access allowed all four to complete; no security settings were changed.
- Review evidence is in the repository parent's `output/hu05-log-review-20261022/`. The temporary staging was removed; source changes remain uncommitted. Nothing was published.

## Delivery and Mercado Libre retirement — 2026-10-22
- Logarithmic scoring is committed as `b664389`; provider retirement is a separate commit `a0c273e` on `feature/uh-5-matching-13f-retire-mercadolibre`.
- Removed the 12 Marketplaces acquisition classes, provider configuration, fictitious JSON fixture and obsolete tests. Preserved all database models, migrations and records, dealer catalog, authentication and resale services. The user approved the 3,553-line retirement exception.
- Regression tests went RED then GREEN. Independent checks passed: 1,151 backend tests / 14,015 assertions, 1,236 web tests, lint, build, Pint and a baseline/candidate search differential. Browser checks passed for all seven diagnosis steps, four priorities, pagination, reload, empty results, login/logout, dealer inventory and seven existing vehicle photos. The same 30-table schema and 141-vehicle hash were preserved; only demo diagnosis timestamps and session/authentication state changed, with answers restored.
- Judgment Day approved with no findings. The four native reviews were approved and exactly acknowledged, closing their authority. Two readability advisories remain future work only: clarify empty source arguments and distinguish generic external compatibility fixtures. Do not reopen this candidate.
- Native traceability document: https://docs.google.com/document/d/1P00J0GrGXOVTDhyVT-YenTw8b8p6hxG85CYrbEXhxoY/edit?usp=drivesdk . It documents original ranking, coarse bands, the logarithmic formula, real Hilux 37,988 versus Versa 1,666 transfer counts (difference 36,322), ACARA retention, estimation limitations and QA evidence.
- Current delivery branch: `feature/uh-5-algoritmo-matching-depreciacion-reventa`. All 24 historical stage tips are ancestors; the user requests ONE accumulated PR to `develop`, not a chain of PRs. The user explicitly waived the issue prerequisite and authorized publishing Mariano Engram to the configured public repository `saracco-juan/td-autos`. No issues, Trello, merge or auto-merge. No publication has occurred yet at this handoff checkpoint; PR creation and remote readback are the remaining steps. Existing Figma follow-up remains pending as previously recorded.
