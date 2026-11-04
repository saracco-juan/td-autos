# Resume checklists from Profile

Profile shows saved inspection and transfer progress without modifying either checklist. It reuses the current catalogs, shared `summarizeChecklist` helper and existing checklist routes, which already open the first pending stage.

## Read contract

`GET /api/inspecciones` requires the existing Sanctum authentication. It returns `pasos` (the inspection catalog) and `inspecciones`: each entry contains `vehiculo` (id, marca, modelo, version, anio), `estado` and `items_completados`. Only the authenticated user's saved checklists are returned, newest `actualizado_en` first, then descending id. Vehicles that no longer exist are excluded. An empty account returns an empty list and no checklist is created.

Transfer uses the existing `GET /api/transferencia`. Profile loads both independently, exposes retry on failure and does not replace unavailable progress with zero. Percentages count distinct marks in the current catalog, ignoring unknown codes. A 100% bar means every catalog item is marked; it does not certify a vehicle or indicate that a purchase has completed.

Load failures are announced as alerts. Tests cover either source failing while the other remains usable, plus a successful retry without losing saved marks. The displayed heading keeps brand/model/year concise, with version underneath; the progress bar retains the full accessible vehicle identity.

## Verify locally

Start the backend and web app as described in [getting started](../getting-started.md). With a buyer account, mark an item in Transfer or in a vehicle's inspection, then open `/perfil`. The percentage must match saved marks; continuing must return to that checklist. Reload to confirm persistence. A second buyer must not see the first buyer's inspections. Test accounts without history show a useful empty state.

Automated checks: `php artisan test --compact tests/Feature/Inspeccion` in `backend`, and `npx vitest run src/test/features/profile --pool=threads --maxWorkers=2` in `frontend/web`.
