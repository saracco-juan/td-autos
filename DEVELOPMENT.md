# TD Autos — development notes

Technical setup that `README.md` does not cover: local environments, tunnels, scripts and maintenance commands. `README.md` stays the source for installing and running each part; add new technical notes here.

## Google sign-in from a phone (development only)

The phone cannot reach the PC's `localhost`, and Google does not accept a LAN IP as a redirect URI. In development the backend is exposed through a Cloudflare quick tunnel so the phone can finish the OAuth flow, while the web keeps using `localhost`.

How it works: a mobile flow (`client=mobile`) sends Google `GOOGLE_MOBILE_REDIRECT_URI` and exchanges the code with the same URI; a web flow uses `GOOGLE_REDIRECT_URI`. The callback must reach the host that started the flow, because the OAuth state lives in that host's session cookie.

### One-time setup

```bash
brew install cloudflared
```

In `backend/.env`, leave `SESSION_DOMAIN=` empty (a `localhost` cookie domain is rejected on the tunnel host and the OAuth state is lost). `APP_URL` and `GOOGLE_REDIRECT_URI` stay on `localhost`.

### Every time the tunnel starts

The quick tunnel URL lives as long as the `cloudflared` process: it changes on every restart.

1. Start the backend and the tunnel, and keep both running:
   ```bash
   php artisan serve --host=0.0.0.0
   ```
   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```
2. Copy the `https://<words>.trycloudflare.com` URL printed under "Your quick Tunnel has been created!".
3. `backend/.env`: `GOOGLE_MOBILE_REDIRECT_URI=https://<words>.trycloudflare.com/auth/google/callback`, then `php artisan config:clear` and restart `serve`.
4. `frontend/mobile/.env`: `EXPO_PUBLIC_API_URL=https://<words>.trycloudflare.com`, then `npx expo start -c` (`EXPO_PUBLIC_*` values are baked into the bundle, so the cache must be cleared).
5. Google Cloud Console → Google Auth Platform → Clients (old console: APIs & Services → Credentials) → the Web client whose ID is `GOOGLE_CLIENT_ID` → Authorized redirect URIs: add the new callback URI, keep `http://localhost:8000/auth/google/callback`, remove old tunnel URIs, Save. It can take a few minutes to apply.

A newly created tunnel may not resolve on the Mac for a few minutes (DNS negative cache); `dig +short <host> @1.1.1.1` confirms it exists. While the tunnel runs, anyone with the URL reaches the local backend: stop it with `Ctrl+C` when done.

Troubleshooting:

- Google shows `Error 400: invalid_request`: the redirect URI is malformed (for example `https://https://…`) or not registered. Check the `redirect_uri` the backend sends: `curl -s -o /dev/null -w "%{redirect_url}\n" "http://localhost:8000/auth/google/redirect?client=mobile&return_to=exp%3A%2F%2Fx"`.
- White screen after picking the account, with `InvalidStateException` in `storage/logs/laravel.log`: the flow started on a different host than the callback (usually `EXPO_PUBLIC_API_URL` still points to the LAN IP), so the session is missing and the backend falls back to the web URL.

For a URL that does not change, use a named Cloudflare tunnel (account and own domain) or an ngrok static domain.

### Production

The backend has its own public HTTPS URL, so no tunnel is needed: `GOOGLE_REDIRECT_URI` points to it and serves web and app, `GOOGLE_MOBILE_REDIRECT_URI` stays empty (falls back to it), and Google Cloud holds a single callback URI. The built app returns through `tdautos://` (`MOBILE_REDIRECT_PREFIXES`); `exp://` (Expo Go) is only accepted outside production.

## Scripts and commands

| What | Command | Notes |
| --- | --- | --- |
| Demo database | `php artisan db:local [--path=<file>]` | Rebuilds `backend/database/manual.sqlite` from scratch (deletes the target file). SQLite only. |
| Administrator account | `php artisan admin:create` | Creates an admin user. |
| Subscription lifecycle | `php artisan suscripciones:procesar` | Inactivates subscriptions past grace, hides their vehicles, deletes those past retention. |
| Engram manifest merge driver | `git config merge.engram-manifest.driver "node scripts/engram-merge-manifest.mjs %O %A %B"` | Once per clone. Merges `engram/*/.engram/manifest.json` as the union of chunks (`.gitattributes`). GitHub does not run it: if `develop` gained engram commits, merge `origin/develop` into the branch locally before merging the PR. |
| Engram import / export | `engram sync --import` / `engram sync --project td-autos` | Run from `engram/<name>/` (see `AGENTS.md`). |

With the merge driver registered, uncommitted engram changes can move to another branch: `git stash push -u -- engram/<name>`, `git switch <branch>`, `git stash pop`.

## HU05 safety, comfort and usage — stage 8

`App\Services\Matching\VehicleSuitabilityScorer` composes declared equipment with the unchanged `RunningRequirementsScorer`. It is pure and does not activate an endpoint, ranking, screen or eligibility filter. Pass the calendar year explicitly.

| Score | Composition (points, not measured safety ratings) |
| --- | --- |
| Safety | ESC25, ABS15, front airbags15, side5, curtain5, ISOFIX5, AEB15, lane5, blind spot5, belt reminder5; speed assistance+2 and driver monitoring+3, capped at100 |
| General comfort | Steering height/reach20, dual-zone15, heated seats10, Android Auto OR CarPlay15, sensors10, cruise15, rear camera15 |
| Contextual equipment | AC OR climate40 and connectivity20; city adds sensors20/camera20, road adds cruise40 |
| Base use | City:60% consumption +40% equipment; road:40% consumption +40% safety +20% equipment; mixed:mean of city/road scores; work:50% maintenance +50% mixed consumption |
| Adjusted use | `(1-alpha)*base + alpha*mean(contextual consumption, maintenance)`; monthly codes `menos_500`/`no_sabe`:0%, `500_1500`:5%, `1500_3000`:10%, `mas_3000`:15% |

`usageScore($vehicle, $use, $monthly, $currentYear)` returns the adjusted use component without rounding; its outer ranking weight remains for a later stage. Work is unchanged by adjustment. Mixed base use averages city/road **scores**, while its consumption component still averages physical readings before banding. An automatic at its best has97.5 maintenance points, so positive adjustment prevents100 usage; do not silently relax the later overbudget gate.

`safetyScore`, `comfortScore` and city/road-only `equipmentScore` expose the individual groups. Unknown facts produce `null` when the selected formula needs them, not zero. In the climate OR group one known true resolves an unknown other flag; both flags true still count once. Connectivity is one existing yes/no field. Publication validation and later full-inventory eligibility remain separate.

No new UI to inspect. From `backend`, run `php artisan test --filter=VehicleSuitabilityScorerTest`. A vehicle with all equipment, urban6/road12 and maintenance43.125 scores100/76/88/51.5625 for city/road/mixed/work with no distance adjustment; mixed becomes82.534375 for `mas_3000`. The unit test needs no database or credentials.

## HU05 consumption and maintenance — stage 7

`App\Services\Matching\RunningRequirementsScorer` is a pure backend service. It reads the existing normalized `Vehiculo` facts without modifying them. No endpoint, ranking or screen is connected in this stage.

- `consumptionScore($vehicle, $use)`: city uses urban L/100 km; road uses road L/100 km; mixed/work average both readings **before** scoring. GNC receives 100 by the agreed cost-of-use rule, without litre readings.
- `maintenanceScore($vehicle, $currentYear)`: 37.5% age + 37.5% odometer + 15% engine + 10% transmission. Power does not participate.

| Component | Bands or adjustment | Points |
| --- | --- | --- |
| Consumption, L/100 km | <=6 / <=8 / <=10 / <=12 / >12 | 100 / 80 / 60 / 40 / 20 |
| Age, years | <=3 / <=7 / <=12 / <=20 / >20 | 100 / 75 / 50 / 25 / 0 |
| Odometer, km | <=40000 / <=80000 / <=140000 / <=200000 / >200000 | 100 / 75 / 50 / 25 / 0 |
| Engine | Start at 100; diesel -25 or GNC -10; turbo subtracts another 25 | Additive deductions |
| Transmission | Manual / automatic | 100 / 75 |

Supply the calendar year explicitly; allowed next-year models use the youngest age band. Fractional points are retained. Missing required facts or unsupported fuels yield `null`, not zero; hybrid/electric remain publishable but unscored. Publication validation still owns field formats/ranges. Scores do not predict failures or maintenance prices, and zero in a component does not exclude a car.

No visible UI change. From `backend`, run `php artisan test --filter=RunningRequirementsScorerTest` (no database or credentials required by this unit test). Examples: urban 6 / road 12 gives mixed 60, not 70; a 10-year-old diesel turbo with 150000 km and automatic transmission gives 43.125 maintenance points. Endpoint/ranking integration belongs to later stages.

## HU05 diagnosis passenger ranges — stage 6

`PUT /api/diagnostico` accepts `1_2`, `3_4`, `5`, `mas_5`: minimum total seats are 2, 4, 5, 6, including the driver. `5_mas` is no longer accepted (422, no writes).

The one-time `2026_10_20_000001_require_legacy_passenger_confirmation` data migration clears only old stored passenger values of 5 and sets `estado=pendiente_pasajeros`; other answers and body links remain intact. `GET /api/diagnostico` returns `pasajeros: null` until re-answered, and the session's `tiene_diagnostico` is false only for that pending state. The web flow opens the passenger question with an explanation and preserves the other answers.

Run the migration before serving the new API/UI, with the application stopped while migrating. It cannot infer the discarded legacy intent. Rollback refuses with `Cannot roll back passenger confirmation while diagnoses exist. Restore a coordinated backup instead.` while any diagnosis exists, preserving answers and migration history; a subsequent `migrate` therefore skips this correction. An empty diagnosis table still permits rollback. Before any deployed migration, take a backup and coordinate clients; no remote migration is part of this stage. Do not delete its migration history or invoke `up()` manually against confirmed answers. To downgrade populated data, restore a coordinated application/database backup rather than bypassing the guard.

Manual check: sign in as a buyer, open `/diagnostico`, choose each of the four passenger ranges, finish, and reopen: the same option and summary must remain selected. With an old five-or-more test diagnosis, migrate first; re-entry must require a new passenger choice and keep all other answers. Matching filters are implemented in a later stage.

## HU05 vehicle facts — storage stage

The additive matching-facts migration and `Vehiculo` casts store actual seats, turbo, power unit,
urban/road consumption (L/100 km), and declared safety/comfort equipment. Existing `moneda`,
`motor` and `potencia` columns are reused. Consumption uses two-decimal precision.

New columns are nullable without defaults: `null` means unknown, `false` means explicitly absent.
No existing vehicle is backfilled from its body type, model or brand. `volante_regulable` means
both height and reach adjustment; `aire_acondicionado` covers AC or climate control. A single
`android_auto_apple_carplay` flag means at least one platform is present. See the API stage below;
forms, CSV and matching remain separate stages.

To verify storage and a forward/rollback cycle without touching a configured database:

```bash
cd backend
php artisan test --filter=VehiculoMatchingFactsTest
```

The tests use SQLite in memory. They check known/unknown values, types and preservation of existing
rows; rollback removes only the new columns (and their values). PostgreSQL DDL is compiled without
connecting; PostgreSQL execution is not covered. No migration was executed against a real database.

## UH-5 core vehicle facts — API stage

Dealer create/update now require `moneda` (ARS/USD), `plazas`, `motor`, `turbo`, `potencia` and
`potencia_unidad` (CV/HP/kW). Gasoline (`nafta`) and diesel also require `consumo_urbano` and
`consumo_ruta` in L/100 km; other fuels may omit them. Seats/power are positive integers; turbo
accepts JSON booleans or multipart 0/1. Consumption is positive with at most two decimals.
Upper bounds come only from storage: seats 32767, power 2147483647, consumption 9999.99.

Create, update, show and list return these facts; unknown legacy values remain null. Currency is
stored as declared, without conversion. Existing ownership, plate, photo and transaction rules stay.
API requests opt into the shared rules; CSV retains its existing contract until its own stage.
The older web form cannot submit the new required facts yet: do not deploy the intermediate chain.
Form controls and matching scores remain in later stages.

### UH-5 safety and comfort — equipment API stage

Create/update also require all 20 equipment fields below, even when the answer is no.
Send JSON `true`/`false` or multipart `1`/`0`; omission, null, empty text and other values return
HTTP 422 with an explanatory Spanish message in `errors.<field>`. No vehicle, ownership or photo
changes are saved on rejection. The frontend stage must display the reason in an alert and beside
the affected controls; this backend stage does not add that UI.

| Group | Required fields |
| --- | --- |
| Safety | `control_estabilidad`, `frenos_abs`, `airbags_frontales`, `airbags_laterales`, `airbags_cortina`, `isofix`, `frenado_autonomo`, `asistencia_carril`, `punto_ciego`, `recordatorio_cinturon` |
| Additional safety | `asistencia_velocidad`, `monitoreo_conductor` |
| Comfort | `volante_regulable`, `climatizador_bizona`, `butacas_calefaccionadas`, `android_auto_apple_carplay`, `sensores_estacionamiento`, `velocidad_crucero`, `camara_retroceso` |
| Usage equipment | `aire_acondicionado` |

Connectivity is **one** answer: true if either Android Auto or Apple CarPlay is present.
Steering adjustment means both height and reach; front airbags cover driver and passenger.
Lane equipment means alert or assistance; air conditioning includes a climate-control system.
Responses return boolean values, while existing unknown equipment remains null until explicitly
declared. No equipment is inferred from a model or body type, and no legacy rows are backfilled.
CSV rules/template remain unchanged until their own stage.

### Manual API check

Start the backend and web app as described in README, using a local test database with the stage-one
migration applied. Sign in on the web as an active dealer. Paste this into that tab's browser console;
only the API host/port may need changing. It uses the same Sanctum session cookie and CSRF header as
the web client. It creates a temporary listing with seven tiny test photos and deletes only that
listing at the end. Do not run this against a production database.

```javascript
await (async () => {
  const api = 'http://localhost:8000';
  await fetch(`${api}/sanctum/csrf-cookie`, { credentials: 'include' });
  const call = async (path, method = 'GET', body) => {
    const headers = { Accept: 'application/json' };
    const token = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='));
    if (token) headers['X-XSRF-TOKEN'] = decodeURIComponent(token.slice(11));
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${api}${path}`, {
      method, headers, credentials: 'include',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const data = response.status === 204 ? null : await response.json();
    console.log(method, path, response.status, data);
    return { status: response.status, data };
  };
  const session = await call('/api/user'); // 200: signed-in dealer
  if (session.status !== 200) throw new Error('Sign in as an active dealer first.');
  const { data: options } = await call('/api/diagnostico');
  const random = crypto.getRandomValues(new Uint32Array(5));
  const letter = n => String.fromCharCode(65 + n % 26);
  const plate = letter(random[0]) + letter(random[1]) + String(random[2] % 1000).padStart(3, '0') + letter(random[3]) + letter(random[4]);
  const fields = {
    patente: plate, marca: 'Toyota', modelo: 'Corolla', anio: 2021, kilometraje: 45000,
    precio: 20000, moneda: 'USD', plazas: 5, motor: '2.0', turbo: 0,
    potencia: 170, potencia_unidad: 'CV', consumo_urbano: 8.5, consumo_ruta: 6.2,
    transmision: 'automatica', combustible: 'nafta', ubicacion: 'Córdoba',
    carroceria_id: options.carrocerias[0].id,
    // Synthetic test declarations; these are not a Corolla specification.
    control_estabilidad: 1, frenos_abs: 1, airbags_frontales: 1, airbags_laterales: 0,
    airbags_cortina: 0, isofix: 1, frenado_autonomo: 0, asistencia_carril: 0,
    punto_ciego: 0, recordatorio_cinturon: 1, asistencia_velocidad: 0, monitoreo_conductor: 0,
    volante_regulable: 1, climatizador_bizona: 0, butacas_calefaccionadas: 0,
    android_auto_apple_carplay: 1, sensores_estacionamiento: 0, velocidad_crucero: 1,
    camara_retroceso: 0, aire_acondicionado: 1,
  };
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  for (let i = 0; i < 7; i++) form.append('fotos[]', new File([bytes], `test${i}.png`, { type: 'image/png' }));
  const created = await call('/api/concesionaria/vehiculos', 'POST', form); // 201, USD, 5 seats, turbo false
  if (created.status !== 201) throw new Error('Fixture creation failed; inspect the logged response.');
  const path = `/api/concesionaria/vehiculos/${created.data.vehiculo.id}`;
  try {
    const incomplete = { ...fields };
    delete incomplete.android_auto_apple_carplay;
    await call(path, 'POST', incomplete); // 422, errors.android_auto_apple_carplay explains the missing answer
    await call(path, 'POST', { ...fields, frenos_abs: null }); // 422, errors.frenos_abs; null is not false
    await call(path); // 200, connectivity and ABS still true; seven photos unchanged
    await call(path, 'POST', { ...fields, android_auto_apple_carplay: false }); // 200, explicit false persisted
    await call(path, 'POST', { ...fields, plazas: 0 }); // 422, errors.plazas, nothing changed
    await call(path); // 200, still 5 seats and seven photos
    await call(path, 'POST', { ...fields, moneda: 'ARS', precio: 25000000, plazas: 7, turbo: true }); // 200, updated facts
    await call('/api/concesionaria/vehiculos'); // 200, listing contains the updated facts
  } finally {
    await call(path, 'DELETE'); // 204, only this newly created fixture removed
  }
})();
```

Automated check: `cd backend; php artisan test --filter=MatchingFactsApiTest` (SQLite in memory).
Equipment check: `php artisan test --filter=EquipmentApiTest` from `backend` (SQLite in memory).

### HU05 stage 4 — manual creation and editing

Use only a disposable local database and an active dealer account. CSV import and the public vehicle detail (HU09) are outside this stage.

1. Open CARGAR VEHÍCULO. Complete basic data, currency, total seats including the driver, engine, turbo, power and unit. Enter urban/road consumption in L/100 km (required for petrol/diesel; optional otherwise), explicitly answer every safety/comfort field, and add seven photos. Android Auto or Apple CarPlay is one yes/no answer, not two.
2. Leave a required answer empty and save: the request is blocked, focus moves to the first error, and the pinned alert explains why. Selecting No is valid; missing data is never inferred from the model.
3. Save, reopen EDITAR and check every answer and photo. Change a yes to No and save again: No must survive reloading. For a USD vehicle, the inventory shows `US$` without converting its amount.
4. With a local API test double returning 422 and `errors.plazas`, save valid data: the same reason appears beside seats and in the alert; values/photos remain available for correction.

Automated check from `frontend/web`: `npx vitest run src/features/inventory`.
Browser check: 1280×800, 768×1024 and 375×812; no horizontal page overflow, readable sections and visible pinned actions/alert.

## HU05 CSV matching facts: local smoke test

Use only a disposable local test inventory. Start the API and web as described in README, sign in as a demo dealer, then open Inventario → IMPORTAR CSV.

1. Download the new template. It remains UTF-8 CSV with a BOM and `;` separators; Excel can edit it. Replace the synthetic example, including its photo URLs, with declared test facts.
2. Preview a complete row: it must report one new vehicle without writing. Confirm, then edit the vehicle: currency, seats, engine, power, consumptions and every equipment answer must match.
3. Reimport that plate with different facts: preview must report an update; confirmation must overwrite those facts and photos, not create a duplicate. Blank GNC consumptions clear previous values.
4. Leave one equipment cell blank or enter `tal vez`: the alert must name its row and field, with no partial import. An old template must request the updated download. `sí`/`si` and `no` are explicit answers; blank is never “no.”
5. The manual form displays power in CV and converts declared HP/kW on edit. CSV keeps an explicit `potencia_unidad` (CV/HP/kW), so enter the unit that actually belongs to the supplied number.

## HU05 local demo smoke test

The README's `db:local --vehiculos=100` rebuilds **only its target SQLite file**: 4 demo dealer vehicles plus 100 volume vehicles. Run it only when discarding that local demo is intended. It does not migrate Supabase.

To keep the normal `.env` untouched, use an ignored `.env.demo` with the README's SQLite/public/local settings, its own local `APP_KEY`, `APP_ENV=demo`, and `APP_CONFIG_CACHE=bootstrap/cache/demo-config.php` (no cached remote configuration). Generate the local key with `php artisan key:generate --env=demo`. The prepared demo on this workstation already has this file.

Start from `backend/` in PowerShell:

```powershell
$env:APP_ENV = 'demo'
php artisan serve --env=demo --host=localhost --port=8000
```

If uploads produce `PHP Request Startup: file created in the system's temporary directory`, PHP's configured `upload_tmp_dir` is invalid or inaccessible. The notice can corrupt JSON, hiding useful validation errors. Stop **your** server; use a writable temp directory for this process only, without changing global PHP settings:

```powershell
# From backend/, with APP_ENV=demo still set:
Set-Location public
php -d "upload_tmp_dir=$env:TEMP" -S localhost:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
```

Start Vite as in README. Sign in as `pampa@demo.tdautos.test` / `TdAutos2026!`. Edit a seeded car: all matching fields must already be filled and seven photos must load. Create another with all fields and seven local PNG files; reopen it and verify the facts/photos. Download the CSV template, fill two synthetic rows (e.g. USD/nafta and ARS/GNC) and seven accessible image URLs each. Preview must not write; confirmation must create both cars. An empty equipment answer must show its row and field and prevent confirmation.

Use `http://localhost:8000/storage/vehiculos/volumen/foto-1.png` through `foto-7.png` as persistent local test URLs after the volume seed. GNC can leave both L/100 km fields empty; explicit `no` must survive import and editing.

Supabase follow-up at HU05 closure: review pending Laravel migrations, then—with separate authorization for the target environment—apply non-destructive migrations and smoke-test login, create/edit, CSV and Storage. Never run `db:local` or `migrate:fresh` against Supabase. Local PostgreSQL DDL compilation is useful but does not prove live connectivity, schema state or Storage permissions.
## HU05 stage 13a: reusable value-retention calculation

`App\Services\Resale\ValueRetentionCalculator` compares two normalized ACARA values without HTTP,
database access or a clock. This is the first resale slice, not a completed importer or ranking integration.

- Points contain `snapshot_id`, canonical `version_id` (make/model/version/generation), `currency`
  (`ARS` or `USD`), integer `model_year` and positive numeric `price`. The source adapter must resolve
  exact identity and ambiguous rows before calling it; display names alone are not a canonical key.
- `compare($reference, $older)` requires matching snapshot/version/currency and an older model year.
  It returns provenance, compared values, year gap, unrounded retained percentage and its complement.
- `threeYearScore($reference, $older)` accepts exactly three years and caps the matching score at 100.
  Raw appreciation remains visible in `compare`; absent/invalid/incomparable evidence returns `null`.
- Annual HU15 detail can compare adjacent years; cumulative detail compares endpoints. Missing annual
  values stay unavailable, but do not invalidate a known three-year pair. Never divide total loss by three.
- These are age-based references at the snapshot date, not historical observations or guaranteed sale prices.

From `backend/`, run `php artisan test --filter=ValueRetentionCalculatorTest`: the suite covers the
Onix reference pair (2024: ARS 19,800,000; 2021: ARS 16,976,000), approximately 85.7374% retained,
identity boundaries, unavailable data and annual/cumulative reuse. There is no new endpoint or screen.
Source acquisition, normalized storage, DNRPA activity and ranking/UI integration remain later slices.

# HU05 stage 9: deterministic dealership ranking

`DealershipRanker` composes the existing running and suitability rubrics without querying data.
Pass current vehicles with `propiedad` loaded, a completed diagnosis with `carrocerias` loaded,
operative dealer IDs from `SubscriptionLifecycle::operativeDealerIds()`, an explicit year and
one optional official sell-rate value. The endpoint/query is stage 11; rate retrieval and metadata are stage 10.

- Hidden, external, inactive-dealer, incomplete and unsupported vehicles are excluded. Seats and transmission are hard gates.
- Base score: usage 35%, body 30%, priority 25%, comfort 10%. Either selected body earns 100; mismatch earns 50 and a warning.
- Above budget, up to 5% inclusive requires matching body, adjusted usage 100 and priority 100; each 1% excess subtracts two points.
- Filter on unrounded score >=70, order by score descending, ARS price ascending, then listing ID; return at most ten concrete listings.
- No quote excludes USD listings but allows ARS, with unknown USD equivalent. `resale_pending` explicitly defers the resale priority.
- Results retain component scores, published/equivalent prices, proportional penalty and warning codes for later presentation.

Check: `cd backend; php artisan test --filter=DealershipRankerTest`. No UI, HTTP, clock or market-valuation dependency is added.

## HU05 stage 10: DolarAPI exchange-rate integration

The single integration class is `App\Services\ExchangeRates\DolarApi`:
`app(DolarApi::class)->current()` returns `quote`, `stale` and `warning`.
It is separate from the deterministic ranker and adds no endpoint or UI yet.

| Field | Meaning |
| --- | --- |
| `quote.sell` | Official USD sell rate in ARS per USD; never the buy rate |
| `quote.source`, `source_url`, `upstream_source` | DolarAPI attribution and original source, Ámbito Financiero |
| `quote.updated_at` | Provider's timestamp, normalized to UTC |
| `quote.fetched_at` | Successful retrieval time, not a replacement for the provider's date |
| `stale`, `warning` | Explicit fallback state; missing quote uses `exchange_rate_unavailable`, old fallback uses `exchange_rate_stale` |

On first use after each three-hour window, one caller claims the refresh before HTTP I/O.
Other callers immediately receive the last snapshot, or unavailable if none exists.
Attempts are throttled even after failures. A successful snapshot has no cache expiry;
failed, malformed, future-dated or backwards-dated responses never replace it.
Unchanged provider dates are valid (for example, outside trading hours); a successful
retrieval confirms availability without inventing a newer provider timestamp.

Use a persistent shared Laravel cache (configured database, file or Redis), not array/null
outside tests. Cache clearing/eviction removes the stored fallback. No credentials or new
environment variables are needed. Requests use fixed HTTPS, bounded connect/total timeouts,
no redirects and no immediate retries. T11 will obtain one snapshot for the entire ranking
and pass `quote.sell` (or null) to `DealershipRanker`; T12 will display attribution/warnings.

Source and interval explicitly replace the earlier DólarHoy/hourly proposal.
Data use and local caching require citing [DolarAPI](https://dolarapi.com/docs/uso);
the [official endpoint documentation](https://dolarapi.com/docs/argentina/operations/get-dolar-oficial)
identifies Ámbito as its source. The service is informational and does not guarantee availability or accuracy.

Manual check from `backend` (no server/login needed yet):
`php artisan test --filter=DolarApiTest` — expected 24 passing tests, with HTTP faked and
array cache. Covers first fetch, three-hour reuse, failures/fallback, recovery, dates and overlapping calls.

## HU05 stage 11: recommendation API

`GET /api/recomendaciones` uses the same Sanctum session/bearer authentication as
`/api/diagnostico`. It accepts no user identity: the authenticated user's saved diagnosis is authoritative.
The thin controller delegates to `App\Services\Matching\DiagnosisRecommendations`.

- `401`: unauthenticated; no provider request.
- `200`, `status: diagnosis_incomplete`: missing/incomplete diagnosis; empty `results`, null `exchange_rate`.
- `200`, `status: resale_pending`: deferred priority; empty `results`, null `exchange_rate`.
- `200`, `status: ready`: zero to ten concrete results; no filler when none qualifies.

Each ready result retains the ranker's unrounded `score`, `components`, published/converted
prices, budget penalty and warning codes, plus whitelisted `vehicle` facts and public `dealer`
identity. It never serializes ownership plates or private dealer contacts. Responses are private/no-store.
`exchange_rate` carries the one DolarAPI snapshot used by every result, including provider/retrieval
dates and stale/unavailable warnings. Without any valid quote, ARS remains eligible and USD is excluded.
Inventory is read afresh using the existing operative-dealer lifecycle (including grace); no
subscription sync, saved ranking or diagnosis/inventory mutation occurs during the GET.
Existing diagnosis/catalog endpoints and the ranking formulas are unchanged; UI is stage 12.

Manual check: start backend/Vite as in README, sign in as a test buyer (Google or password),
then paste below into the web app's browser console. **This replaces that test buyer's diagnosis.**
Cookies and CSRF match the real web client; adjust only host/port if needed.

```javascript
const api = 'http://localhost:8000';
await fetch(`${api}/sanctum/csrf-cookie`, { credentials: 'include' });
const xsrf = decodeURIComponent(document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN=')).slice(11));
const saved = await fetch(`${api}/api/diagnostico`, {
  method: 'PUT', credentials: 'include',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
  body: JSON.stringify({ presupuesto: 'mas_40m', uso_principal: 'ciudad', pasajeros: '1_2',
    kilometros_mensuales: 'menos_500', transmision: 'indiferente', prioridad: 'consumo', carrocerias: [1] })
});
console.log('Diagnosis:', saved.status, await saved.json()); // 200, saved answers.
const result = await fetch(`${api}/api/recomendaciones`, {
  credentials: 'include', headers: { Accept: 'application/json' }
});
console.log('Recommendations:', result.status, await result.json()); // 200, ready + results + exchange_rate.
```

For isolated scenarios (401, pending states, filtering, recalculation, quote failure/staleness):
`cd backend; php artisan test --filter=RecommendationsTest`. All HTTP is faked and DB state is disposable.
## HU05 recommendation screen

With the README backend/Vite servers running, sign in as a **buyer**, open
`http://localhost:5173/diagnostico`, complete the questionnaire and choose
**VER RECOMENDACIONES**. Use consumption, safety or maintenance; resale is deferred.
The screen now calls `GET /api/recomendaciones`, not catalog search.

- Expect up to ten real dealership listings, ordered by backend compatibility.
  Nine fit on page one; the tenth is on page two, without another API request.
- Check published and equivalent ARS/USD prices and the quote source/date.
  Open **Ver atributos y motivos** for grouped facts and component scores.
- Above-budget/body mismatches show warnings. If no car qualifies, adjust the
  diagnosis; the screen does not fill the list with unrelated cars.
- An incomplete diagnosis or deferred resale priority explains why there is no
  ranking. Request failures offer **REINTENTAR**; unavailable/stale quotes are explicit.
- Revisit after changing the diagnosis to fetch fresh recommendations. No search,
  catalog tab, comparison or detailed HU09 sheet is introduced in this stage.

Run the isolated frontend checks with
`npm run test -- src/features/recommendations/MatchingRecommendationsPage.test.tsx src/features/recommendations/matching.test.ts`
from `frontend/web`. These tests fake API data and never change the local inventory.
