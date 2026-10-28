# HU05 recommendations

Value retention, dealership ranking, DolarAPI exchange rate, recommendation API and recommendation screen. Index: [`development.md`](../development.md).

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

## HU05 stage 9: deterministic dealership ranking

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

## HU05-MOBILE recommendation screen

The `Recomendados` tab calls the same `GET /api/recomendaciones` with the session bearer token
(`features/recommendations/api.ts`) and asks again every time the tab gains focus, so finishing the
diagnosis again shows the recalculated ranking. Filters (HU07) and pagination run on the device over
the returned results, with the same shared helpers as web (`@shared/recommendations/*`).

Isolated checks, from `frontend/mobile`:
`npx jest src/__tests__/features/recommendations` (faked API; no backend needed).
