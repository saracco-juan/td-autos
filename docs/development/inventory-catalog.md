# Inventory catalog

Shared inventory identity catalog (HU21/HU22), catalog-linked manual entry, ACARA PDF reader and the fixed ACARA catalog. Index: [`development.md`](../development.md).

## HU21/HU22: shared inventory identity catalog

`GET /api/concesionaria/vehiculos/catalogo` exposes the cached ACARA identities to
authenticated, approved dealers using the existing active-subscription guard.
It returns `snapshot_id`, `source_date`, `stale`, `warning` and sorted `entries`
containing `id`, `marca`, `modelo` and `version`. An unavailable snapshot returns
HTTP 503 with `acara_unavailable`; a stale snapshot remains available with
`acara_stale`. This read does not refresh or parse a PDF.

`App\Services\Inventario\VehicleCatalog` is the shared projection for the planned
form selectors and XLSX template. It retains versions without year prices and
deduplicates identical identities only; it never merges their price curves.
Conflicting labels under the same ID are excluded rather than selecting the first.
IDs are source-label hashes, not permanent IDs across source renames. The catalog
projection does not modify the price snapshot or vehicle records. The existing
dealer guard still performs its normal subscription lifecycle synchronization.

To smoke-test, start the backend and web app as described in `getting-started.md`,
sign in as an active dealer, and run this in the web app's browser console:

```js
const response = await fetch('http://localhost:8000/api/concesionaria/vehiculos/catalogo', {
  credentials: 'include', headers: { Accept: 'application/json' },
});
console.log(response.status, await response.json());
```

Expect 200 and catalog entries when the permanent catalog is loaded, or 503 with the
explicit unavailable state otherwise. An unauthenticated request returns 401;
a non-dealer or unapproved dealer returns 403. No new UI is wired in this step.

## Catalog-linked manual inventory entry

Manual vehicle creation now requires `acara_version_id` and the exact
`marca`/`modelo`/`version` tuple returned by the dealer catalog endpoint. The web
form supplies searchable native suggestions in that order and clears dependent
selections when the parent changes. Free text outside the catalog cannot be
submitted as a new identity; the API independently validates the tuple.

The nullable `vehiculo.acara_version_id` migration adds no automatic backfill.
Apply the normal migrations from the setup guide in the intended environment
before serving this API version; these changes have only been migrated in test
databases, not the live inventory. Existing vehicles may retain their unchanged
identity while editing other fields, even when the catalog is unavailable.
Changing identity requires a catalog selection. Omitting the ID on an unchanged
edit preserves the stored reference rather than silently unlinking it.

The resale scorer resolves linked vehicles by that exact source ID; a disappeared
or duplicate ID produces no price reference, never an approximate substitute.
Unlinked legacy vehicles retain the previous matching path. Year-price coverage,
retention formulas and DNRPA activity remain independent and unchanged. Selecting
a catalog version does not verify the dealer's other technical declarations or
guarantee that depreciation can be estimated. IDs remain label hashes and may
change if the source renames a version.

Manual smoke test after starting the API/web app as in `getting-started.md`:

1. Sign in as an active dealer and open **CARGAR VEHÍCULO**. Search for a make,
   then a model, then a version. Each list contains only its applicable options.
2. Change the make: the model/version clear. Enter an unknown version and submit:
   the form explains that a catalog selection is required and saves nothing.
3. Choose a valid identity, complete the other fields and add seven photos in a
   disposable test environment. Save: the dealer inventory receives the vehicle
   and its catalog ID. A missing ACARA price for the chosen year does not block
   this identity selection or invent a price.
4. Edit an unlinked legacy vehicle without changing its identity: unrelated edits
   remain allowed. The notice explains how to link it explicitly.

XLSX template/import replacement is a separate pending unit; CSV has not yet been
removed by this manual-entry unit. Until that replacement, an import preserves a
link only when its identity labels stay unchanged; changing them clears the old
link instead of retaining a reference to a different vehicle version.

## HU05 stage 13b: ACARA PDF reader

`App\Services\Resale\AcaraPriceReader::read($pdfBytes)` normalizes the official
[ACARA guide](https://www.acara.org.ar/guia-oficial-de-precios) using positioned
cells, not flattened text. Install the locked `smalot/pdfparser` with Composer.
The dependency is LGPL-3.0 and upstream describes it as limited-maintenance.

- Output includes `source_date`, SHA-256, `snapshot_id` and source rows with make,
  model, wrapped version, stable source `version_id`, currency and one-based page.
- `values` maps model years to decimal strings or null for printed dashes.
  `zero_km_price` is separate: it is **not** the newest model-year value.
- Headers may change within a page; continuations inherit table context. Printed
  dates must agree across the document, but need not appear on every page.
- Invalid dates, unknown currencies, malformed prices or shifted/missing cells
  throw `UnexpectedValueException`; no partial result is returned or persisted.
- Source labels are not inventory identifiers. There is no fuzzy model matching,
  inferred equipment, download, database write, scheduler or ranking change yet.
  Values describe one guide snapshot, not historical realized resale prices.

Run `php artisan test --filter=AcaraPriceReaderTest` from `backend` for synthetic
PDF tests without network or database access. For a locally downloaded guide:

```php
require 'vendor/autoload.php'; // Run from backend with php -d memory_limit=512M.
$snapshot = (new App\Services\Resale\AcaraPriceReader)->read(file_get_contents($pdfPath));
echo $snapshot['source_date'].' '.count($snapshot['rows']);
```

The supplied 19/10/2026 PDF produced 7,390 rows across 384 pages (~328 MiB peak,
~7 seconds on local PHP 8.2). Input is limited to 25 MiB, 500 pages and 2 MiB per
decoded stream; these are **not** a total memory/time sandbox. Before scheduled
ingestion, run in a bounded background worker and validate deployment resources;
do not expose arbitrary PDF uploads or execute this in recommendation requests.

## Fixed ACARA catalog (HU05/HU21)

The fixed catalog is loaded once into permanent tables and served through a local,
disposable cache. See [setup, storage and cache behavior](../fixed-catalog.md) for the
explicit local-PDF import, failure cases and maintenance boundaries. Deployed environments load the
bundled snapshot on container start with `php artisan catalog:load-bundled` (a no-op once any catalog is
loaded; see [infrastructure.md](../infrastructure.md#fixed-catalog-deployment-boundary)). Tests:
`php artisan test --filter=LoadBundledCatalogTest`.

`AcaraPriceSource::current()` preserves its `snapshot/stale/warning` envelope,
source date, hash, URL and `fetched_at` (the one-time import time). The existing
14-day age warning remains: fixed prices are not presented as current market data.
Missing prices remain null and conflicting source curves remain distinct.

`acara:refresh` and its automatic schedule are removed. DNRPA and subscription
schedules are unchanged. Requests never download or parse the PDF.
Offline source/API/schedule checks: `php artisan test --filter=FixedAcaraSourceTest`.
The catalog endpoint remains usable after local cache loss once the tables are loaded.

Thesis documentation updates remain pending in Engram
(`documentation/thesis-catalog-xlsx-pending`); these are implementation notes only.
