# HU05 resale data and ranking

Resale demo listings, resale ranking, DNRPA activity (reader, calculation, acquisition, history) and resale activity score. Index: [`development.md`](../development.md).

## Repair the ten HU05 resale demo listings

`ResaleDemoRepairSeeder` is an **opt-in local SQLite repair**, not a migration or an inventory import.
It corrects the ten synthetic listings inspected on 2026-10-22. It never creates or deletes cars,
changes their year/price/owner/photos, or modifies the CSV/form contract. Missing fixtures are skipped;
ambiguous, non-demo or unexpected matches abort and roll back the entire repair. Rerunning is a no-op.
General volume seeds remain synthetic; this repair is not an authoritative vehicle specification service.

Before running it, back up the configured local SQLite database using SQLite's backup API (not a
live file copy). From the repository root, with Python available, choose a **new** backup filename:

```python
import pathlib, sqlite3
source = pathlib.Path("backend/database/manual.sqlite").resolve()
backup = source.with_name("manual.before-resale-repair.sqlite")
with backup.open("xb"):
    pass  # Refuse to overwrite an existing backup.
with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as src:
    with sqlite3.connect(backup) as dst:
        src.backup(dst)
        assert dst.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
```

Then, from `backend`, using the local SQLite configuration:

```bash
php artisan db:seed --class=ResaleDemoRepairSeeder
php vendor/bin/phpunit tests/Feature/ResaleDemoRepairTest.php
```

Identity references are the ACARA 2026-10-19 catalog: Cactus Feel Pack AT (p.53), Pulse Drive CVT
(p.69), Civic EXS 1.8 AT / EX-L 2.0 CVT and HR-V EX-L 1.8 CVT (pp.99–100), Versa Advance AT
(p.144), 408 Allure Pack THP Tiptronic (p.153), Corolla XEI 1.8 CVT (p.187), Virtus Highline
Tiptronic (p.221). Descriptions, consumption, equipment and images still explicitly represent demo
data, not real offers. No year or missing price is changed to manufacture a three-year estimate.

For a manual check, start the API and web as in `getting-started.md`, open the demo buyer's
recommendations and expand vehicle attributes. Titles and engine/power/turbo must agree with the
selected demo variants. Existing photos and prices must remain unchanged. This repair alone does
not itself add tolerant catalog matching.

### Resale reference matching

The scorer resolves references locally within the same normalized make/model. Exact labels retain
priority; otherwise engine, transmission, stated power/generation and the listing year constrain
trim-token matching. Word order, technical catalog annotations and automatic/Tiptronic labels do
not require changing the listing. A single long token may differ by at most two edits only when
no strict candidate exists; ambiguous candidates abstain unless they meet the compatible-group rules below. Trim modifiers such as
Pack, Plus, Bitono and Cuero remain significant. This is conservative lookup, not vehicle validation.

Turbo words (`turbo`, `TSI`, `TFSI`, `THP`, `TBI`) use one shared vocabulary for technical
recognition and removal from trim tokens. Thus `Core 1.4 Turbo MT` and `1.4T MT Core`
can identify the same version without changing the listing, in both exact and related-family
lookup. Explicit turbo, engine, power and gearbox contradictions still reject the reference;
real trim modifiers remain significant. This rule is independent of vehicle make/model.

The response includes the selected `resale.reference` even when its three-year endpoint is absent.
DNRPA family activity is independent of price-reference availability; diesel/GTI groups stay separate.
A complete resale score still requires both activity and retention. Prices must come from one
version/generation and currency: missing years are never stitched from another row.
Thus finding a catalog model does not guarantee a complete resale estimate. Inventory and CSV
contracts are unchanged, and recommendation requests never persist corrected labels.

### Annualized depreciation estimates

For an identified reference curve with at least two finite positive model-year prices, each
adjacent available-year interval contributes `log(older_price / newer_price) / year_gap`.
The median of these log-retention rates estimates annual retention; gaps need not equal three.
All valid year points on that one curve contribute, irrespective of their input order. The
three-year matching component remains comparable across cars: `100 * exp(3 * median_rate)`,
capped at 100 only for scoring. Raw appreciation and annual depreciation remain visible.

The API's additive `resale.estimate` records the method, used years, interval count, source identity,
annual rate and modeled horizon. `comparison` remains an observed endpoint comparison, or null
when the exact pair is absent; legacy `compare()` and `threeYearScore()` contracts are unchanged.
These same-date model-year references estimate age-related differences, not observed historical
price changes. A single valid year is insufficient; the listing's exact year need not have a price.

### Compatible version groups

Catalog slash-separated names are alternatives, not words a dealer must reproduce together.
Explicit technical conflicts still reject a candidate. Available listing-year evidence takes
precedence across matching tiers, preventing an old exact label from hiding a supported generation.
Otherwise other available years may support an estimate. Engine suffixes and numbered gearboxes
are interpreted with shared technical rules, not per-make or per-model aliases.

An unresolved set may be estimated only if every pair shares make/model, currency and parsed
engine/power/gearbox/body/door/fuel/special identity, has overlapping positive year prices, and
differs by at most **5% in every overlapping year**. This initial conservative tolerance is global;
it is not a claim that all such cars are identical. Pairwise checks prevent transitive price chains.
Each reference/version's rate is computed on its own curve; only rates are aggregated. The UI reports
the candidate count and retention range, without claiming an exact version. No source prices are
stitched or rewritten. Raw projections may exceed 100%; only the ranking component is capped.
No form, CSV, catalog refresh or inventory repair is involved.

## HU05 matching and resale development notes

## HU05 resale ranking (stage13d)

Recommendations read local ACARA and DNRPA snapshots once per resale diagnosis; requests never refresh either source. Exact normalized make/model/version must identify one ACARA curve. Missing or ambiguous evidence remains unavailable. Verified resale is 50% activity and 50% exact three-year retention, inside the existing 25% priority weight. Raw retention and source dates remain available in `resale`; no prediction of future sale proceeds is made.

For unavailable resale only, normalize usage/body/comfort over their 75% weight, require >=70 before deducting 10 points, and show partial compatibility (possibly 60–69.99). No overbudget exception is permitted. Other priorities retain their previous payload and calculation. API `components.priority` can be null for partial resale, never an invented zero. Stale last-valid evidence is used with a warning.

### Isolated smoke test (no application database or network)

From `backend`, run:

```powershell
php artisan test --compact tests/Unit/Services/Resale/ResaleScorerTest.php tests/Unit/Services/Matching/DealershipRankerTest.php tests/Feature/Matching/RecommendationsTest.php
```

Expected: all tests pass using in-memory SQLite and HTTP fakes. The API test checks 97.5 compatibility from 100 activity / 80 retention, missing evidence 90, dated stale fallback and unchanged public inventory. Unit cases include pre-deduction 70 -> displayed 60, strict budget denial and untouched other priorities.

For the UI, start backend/web as in README, sign in as a buyer, choose resale in the saved diagnosis, and open recommendations. Compatible listings without evidence show the ten-point uncertainty notice and "Prioridad: no disponible" in reasons; dated evidence shows DNRPA window and ACARA date. Local DNRPA tables must already exist (stage13c3 migration); this implementation does not migrate the developer database or install schedulers. Figma resale copy synchronization requires separate approval.

## DNRPA monthly activity reader (HU05, first stage 13c slice)

`App\Services\Resale\DnrpaActivityReader::read($stream, $month, $catalog)` consumes
a caller-owned, comma-delimited UTF-8 CSV stream and the existing ACARA reader's
snapshot. It returns monthly transfer counts by normalized make/model, catalog
snapshot identity and identified/unmatched coverage. The caller closes the stream.

- Match the exact normalized make, remove an exact repeated make prefix, then
  select the longest complete ACARA model prefix (Corolla Cross before Corolla).
  Ordinary versions share a bucket. No fuzzy matches or manual alias catalog.
- Split literal whole-token `GTI` or `diesel` only when also present in that
  family's ACARA model/version text. No inference from `N`, `TDI`, `HDI`, power,
  transmission or engine size. Unmarked groups do not mean verified petrol cars.
- Invalid headers, dates, row widths or an empty month reject the entire result.
  Missing vehicle identities count as unmatched, not as a failed month. Only
  aggregate vehicle fields escape; no holder data or raw rows.
- Counts describe registered transfers, not sale probability. They include all
  source vehicle types; catalog presence alone adds no activity. No claim of
  exact version/engine identity or measured coverage for these revised rules.

Offline smoke test (synthetic input; no server, login, downloads or DB needed):

```powershell
cd backend
php artisan test --filter=DnrpaActivityReaderTest
```

Expect all tests to pass, including ordinary/special grouping, nested model names,
unmatched identities, numeric models and whole-month rejection. There is no new
screen or API yet. Automatic download, historical snapshots, the six-month window,
quintiles and recommendation integration remain subsequent slices.

## DNRPA six-month activity calculation (HU05, stage 13c2a)

`App\Services\Resale\DnrpaActivityCalculator` calculates activity from the existing
monthly reader's aggregate snapshots. It does not fetch, persist, or mutate data.
Pass an explicit `DateTimeImmutable` cutoff; there is no hidden clock access.

- `monthsEndingAt('2026-09', $cutoff)` returns April through September when the
  cutoff is in October or later. An invalid/current/future end month returns null.
- `calculate($history, $cutoff)` selects the latest available closed month and its
  five predecessors, ignoring older history and current/future observations.
  Gaps, duplicate closed months, inconsistent counts or different ACARA catalog
  snapshots return null; no shorter window or missing months padded with zeros.
- Sum make/model/special counts across those six months, preserving variants and
  identified/unmatched totals. Unidentified models get no row and no zero score.
- Rank observed groups by transfers. Points are 100/80/60/40/20 by quintile;
  ties use the number of groups strictly above them divided by `N - 1`.
  Integer arithmetic chooses the band without floating-point boundary rounding.
  A single group scores 100; ties and populations below five can leave bands empty.
  These relative points are not sale probabilities or evidence of high volume.

Offline manual check (synthetic snapshots, no network/server/login/DB needed):

```powershell
cd backend
php artisan test --filter=DnrpaActivityCalculatorTest
```

Expect passing tests for six-month totals, gaps, year rollover, ties, small
populations and the existing reader's output. No screen or API changed.
Official archive acquisition is the next cut (13c2b); persistence/history,
14-day scheduled checks and recommendation integration remain separate work.
## DNRPA automatic acquisition (HU05 stage 13c2b)

`App\Services\Resale\DnrpaActivitySource::fetch($catalog, $asOf)` discovers the latest
published closed month from the [official CKAN metadata](https://datos.jus.gob.ar/api/3/action/package_show?id=transferencias-de-autos).
It downloads the annual ZIPs needed for that six-month window (two across a year
boundary), then reuses the monthly reader and activity calculator. It returns
`snapshots`, `activity`, `archives` (URL and SHA-256), and `source_url`; never raw
CSV rows or holder details. The same caller-supplied ACARA catalog identifies every month.

This is an acquisition service, not yet a scheduled job or a recommendation API.
Persistence/history, fortnightly refresh and last-good fallback follow in 13c3;
ranking integration follows separately. Calling `fetch` performs network I/O;
constructing the service does not. A failure throws and returns no partial window.

Downloads require verified HTTPS on the official dataset path, reject redirects,
and use 20-second connection / 90-second request timeouts. Streamed and actual
limits are 2 MiB metadata and 80 MiB per ZIP. ZIP support (`ext-zip`, PHP 8.2+) is
required; its absence fails explicitly. No extension is installed automatically.
Only exact, unique month members are read (at most 24 archive entries, 64 MiB per
selected member), with byte count and CRC checked before parsing. Compressed
temporary downloads are closed on success/failure; CSV members are never extracted.

### Offline check (no server, login, database or live downloads)

```powershell
cd D:\DaVinci\TESIS\td-autos\backend
php artisan test --filter=DnrpaActivitySourceTest
```

Expected: all source tests pass, covering six-month acquisition, year rollover,
provenance, private-field exclusion, bounded HTTPS, invalid sources/archives and
temporary-stream cleanup. HTTP is faked with generated ZIPs; no inventory changes.

## DNRPA history and fortnightly checks (HU05 stage 13c3)

`DnrpaActivityStore::current()` and `history()` read only the local database.
Two new tables hold the attempt/check timestamps and append-only monthly window
versions, including the six aggregates, archive provenance and retrieval date.
Clearing cache does not delete DNRPA history. No holder details or raw CSVs are stored.

`dnrpa:refresh` atomically claims one attempt every 14 days before I/O, including
failed attempts. A published new month triggers acquisition and transactional
publication. An unchanged month checks metadata only, preserving the original
retrieval date and history; it does not recalculate for a changed ACARA catalog.
Older source months or failures retain the last valid version. A separate successful
check date controls `dnrpa_stale`; no saved version yields `dnrpa_unavailable`.
Readers see the snapshot and check date in one query. A superseded attempt cannot publish.

The daily 01:00 scheduler runs in a separate 512 MiB / 600-second PHP process with
a 15-minute overlap guard. The durable database claim also covers manual callers.
No host cron is installed here. Before operational use, apply the additive migration
and initialize ACARA with `php artisan catalog:import-acara <local-pdf>`; a missing catalog fails
safely. Tests use isolated SQLite; existing inventory and remote Supabase are untouched.
Recommendation integration remains the next stage.

### Offline check (no server or login)

```powershell
cd D:\DaVinci\TESIS\td-autos\backend
php artisan test --filter=DnrpaActivityStoreTest
```

Expected: history survives cache flush; 14-day boundaries, unchanged/new months,
overlapping/superseded calls, rollback, stale fallback and bounded schedule pass.

## HU05 demo vehicle profiles

Los vehículos de demo y de volumen incluyen los nuevos atributos de HU05: plazas, motor, turbo, potencia en CV, consumos y todas las respuestas de seguridad/confort (Android Auto o Apple CarPlay es un único sí/no). Onix y Corolla de demo tienen cinco plazas. Son **perfiles sintéticos de prueba**, no fichas técnicas verificadas: el aviso también aparece en su descripción. Los consumos de nafta/diésel están en L/100 km; GNC queda sin litros informados. No se completan automáticamente vehículos de otras bases ni publicaciones reales.

Una demo moderada se reconstruye con `php artisan db:local --vehiculos=100`: deja los 4 autos de las concesionarias de demo más 100 de volumen. Para importar, descargar la plantilla actual desde Inventario → Importar y usar siete URLs accesibles de fotos por fila; la importación conserva las URLs, mientras la carga manual sube los archivos. También se pueden reutilizar las imágenes PNG de `backend/database/seeders/assets/demo-vehicles/` al crear un vehículo manualmente.


## Puntaje de actividad de reventa

HU05 suma las transferencias DNRPA de seis meses cerrados por grupo identificado de marca/modelo. El puntaje continuo es `100 * log(1 + transferencias) / log(1 + máximo del período)`: el mayor volumen recibe 100 y los demás valores crecen con rendimientos decrecientes, sin bandas por percentiles. Los empates conservan el mismo puntaje.

La búsqueda actual muestra vehículos elegibles de concesionarias; la integración de Mercado Libre fue retirada. Los registros históricos de publicaciones externas se conservan, pero ya no se consultan ni se actualizan. La lectura de reventa recalcula el puntaje desde los conteos guardados; no modifica el historial ni descarga nuevamente las fuentes. Con 37.988 y 1.666 transferencias, los puntajes son 100 y aproximadamente 70,4. Es un índice relativo de actividad, no una probabilidad de venta. La prioridad de reventa mantiene 50% de actividad DNRPA y 50% de retención ACARA.

### Approximate related model families

Exact-family version candidates always win. With none, a whole-token model-name extension
may supply an approximate reference only within the same make and one unique family.
Engine, CV power, transmission, body/door evidence, trim alias and listing-year price must agree;
missing or competing evidence abstains. Existing fuel, turbo, generation and gearbox guards apply.
This is inference, not proof of model identity: the API/UI expose both family labels and explicitly
mark the retention reference approximate. DNRPA activity remains independently tied to the published
model family; no transfers are reassigned to the inferred ACARA family. No observed listing
comparison is claimed. No model-specific aliases, ingestion changes or cross-family curve stitching.
