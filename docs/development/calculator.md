# Ownership cost calculator (HU10)

Monthly refresh, yearly review, and the insurance, patente and service models. Index: [`development.md`](../development.md).

## Calculator monthly refresh (HU10)

`php artisan calculadora:refresh` keeps the moving values of the ownership cost calculator up to date and stores one snapshot per run in `calculator_refresh_snapshot` (`App\Models\CalculatorRefreshSnapshot`: fetch date, status `valid`/`failed`, fuel source date, CPI month and the effective values as JSON). Readers (`EffectiveRates`) use the latest `valid` snapshot over `config/calculadora.php`; the config is the fallback when there is none. A source that fails keeps its part from the previous valid snapshot, and an attempt where nothing answered is recorded as `failed` without replacing anything.

| Value | Source | How it is used |
| --- | --- | --- |
| Fuel prices per province (nafta, diesel, GNC) | Secretaría de Energía, CKAN package `precios-en-surtidor`, resource "Precios vigentes en surtidor - Resolución 314/2016" (CSV, ~9 MB, streamed; the resource URL is resolved from the package, never hardcoded) | 90th percentile of the daytime (`Diurno`) price per product and province, ignoring zero prices. The dealer's province wins, then the national 90th percentile, then `fuel_prices` in the config |
| CPI | INDEC IPC nivel general nacional (`148.3_INIVELNAL_DICI_M_26`, datos.gob.ar series API) | ARS amounts (`transfer.fixed_costs`) are multiplied by `max(1, CPI latest / CPI of cpi_base_month)`. The insurance floor (`insurance.tc_floor`; never the rates), the patente bracket limits, fixed amounts and minimums (`patente.scale`, `patente.bracket_rate`, `patente.rules.*.minimum`; never their rates) and the service prices (`service.brands.*.models` and `.body`, `service.fallback.body`; never the intervals) use their own months, `insurance.cpi_base_month`, `patente.cpi_base_month` (or `patente.province_cpi_base_month` for CABA and Mendoza) and the `cpi_base_month` of each service brand and of `service.fallback`, with the same floor at 1. The snapshot keeps each of those months' index in `cpi.extra_bases` and the refresh fetches every base month in use; while INDEC has not published it, it is left out and the factor is 1. Snapshots without `extra_bases` stay readable |

`rates_updated_at` in the costs response is the older of the config `updated_at` (hand review of percentages, scales and service prices) and the fuel price date of the latest valid snapshot; without a snapshot it is the config `updated_at`.

Schedule: the 1st of each month at 04:00 Argentina time (`routes/console.php`, without overlap). Render free has no scheduler, so in deploy the GitHub workflow `Cron` calls `POST /internal/cron/calculadora` (same `CRON_SECRET` bearer as the subscriptions endpoint) at `0 7 1 * *` UTC; "Run workflow" by hand triggers it too. The endpoint answers 503 (and the job turns red) unless both sources refreshed, the same rule as the command's exit code.

Run it locally against a throwaway SQLite database (it downloads the real sources, never touches production):

```powershell
cd backend
New-Item -ItemType File -Force $env:TEMP\calc.sqlite | Out-Null
$env:DB_CONNECTION = 'sqlite'; $env:DB_DATABASE = "$env:TEMP\calc.sqlite"; $env:DB_URL = ''; $env:CACHE_STORE = 'array'
php artisan migrate --force
php artisan calculadora:refresh
php artisan schedule:list
```

Expect `Fuel prices: refreshed (...)`, `CPI: refreshed (...)` and exit 0; exit 1 means a source kept its previous value. Tests: `php artisan test --filter=CalculatorRefreshTest` (HTTP faked).

### Calculator yearly review

No source publishes the percentages, scales and service prices in a machine-readable form, so they are reviewed by hand once a year. `php artisan calculadora:review` (`App\Services\Calculadora\CalculatorReview`) is the control that reminds you. It **only alerts**: it never writes and never changes a rate; the values in force keep working, indexed by CPI.

- Each hand-reviewed group is declared in the `review` block of `config/calculadora.php`: `label`, `config_path`, `reviewed_at` (ISO date) and `sources` (URLs).
- A group is **stale** when `reviewed_at` is more than `review.max_age_months` (12) ago. Every source URL is requested once (GET, 5 s timeout) and reported when it answers 4xx/5xx or does not connect. The latest valid monthly snapshot is reported late when it is older than `review.snapshot_max_age_days` (40).
- Schedule: January 1 at 05:00 Argentina time (`routes/console.php`, without overlap). In deploy, the GitHub workflow `Cron` calls `POST /internal/cron/calculadora-revision` (same `CRON_SECRET_PROD` bearer) at `0 8 1 1 *` UTC. The endpoint answers 200 with the review plus `title` and a Spanish `markdown` checklist; the job opens an issue with it (needs `issues: write`, already set on the job) unless nothing is stale. "Run workflow" by hand runs it too and opens an issue when something is stale.

Run it locally (read-only; any database works, it only reads the latest snapshot):

```powershell
cd backend
php artisan calculadora:review
```

It prints the stale and fresh groups, the unreachable sources and the snapshot age, and always exits 0.

After reviewing a group (checking its sources and updating the values in `config/calculadora.php`), set its `reviewed_at` under `review.groups.<key>` to the review date, in the same commit as the values. Close the yearly issue when every checkbox is done. A source that moved: replace its URL in `sources`.

By hand, once a year (nothing publishes them and they apply to the price): the percentages in `config/calculadora.php` (`transfer.dnrpa_rate`, `transfer.stamp_rate`, the `patente` scales and flat rates, `service.fuel_factor` and the service intervals), and, when the ARS amounts are reviewed, move the base month that goes with them to the month they are stated in (`cpi_base_month` for `transfer.fixed_costs`, `insurance.cpi_base_month`, `patente.cpi_base_month` and `patente.province_cpi_base_month`, and the `cpi_base_month` of each `service.brands.*` and of `service.fallback`). The CPI refresh fetches every base month in use (today 2025-09, 2025-12, 2026-01, 2026-02, 2026-08 and 2026-10). Update `updated_at` too.

### Insurance model

The `insurance` block of `config/calculadora.php` is a CENTRAL estimate (the service, fuel and transfer are still a ceiling): a monthly floor plus a fraction of the price, the way the survey cars behave (a premium grows with the value of the car, but not proportionally).

- Terceros completo (TC) per month = `ceil_step((tc_floor + tc_value_rate x price) x zone_factor[province])`. `tc_floor` is ARS at AMBA prices (46,000 at 2026-10) and `tc_value_rate` is a fraction of the price per MONTH (0.0037, 4.4% a year).
- Todo riesgo con franquicia (TR) per month = `ceil_step(TC x tr_ratio)` with a single `tr_ratio` (1.5), where TC is the terceros completo already rounded up to the step, so the tooltip can explain it from the figure on the screen.
- A province outside `zone_factor` (or unknown) takes `zone_factor.default` (0.70). Misiones, for instance, is not listed.
- Not modeled: the body type and the age of the car (the price already carries both), and GNC conversion. The body type of the vehicle no longer reaches the insurance.
- `tc_floor` and `tc_value_rate` were fitted on the 6 AMBA terceros-completo points of the validation survey (Oct 2026); they are the only fitted values. Reference cases: Yaris, Buenos Aires, price 20,641,300 -> TC 123,000; Taos, CABA, price 38,985,600 -> TC 191,000 and TR 287,000; Etios, Misiones, price 14,021,500 -> TC 69,000. `tests/Feature/Calculadora/InsuranceConfigTest.php` checks them against the real config.

Review it once a year, together with `updated_at` and `insurance.cpi_base_month`:

| Value | Source | What to do |
| --- | --- | --- |
| `tc_floor` (ARS per month, AMBA) and `tc_value_rate` | Re-fit on a fresh survey of terceros completo quotes in AMBA (the Oct 2026 survey is the first); ranges in multicotizadorseguros.com (https://multicotizadorseguros.com/ar/guias/tabla-de-precios-seguros-autos-argentina) and hacecuentas (2.5-3.5% of the value a year, unverified) for the order of magnitude | Re-fit the pair on the new quotes and set `insurance.cpi_base_month` to the month of the survey. The monthly refresh indexes only `tc_floor`; `tc_value_rate` is never indexed |
| `tr_ratio` | multicotizadorseguros.com TR and TC ranges by class; cuantomecuesta.com (a deductible lowers TR 20-35%) | Recompute the single ratio |
| `zone_factor` | seguroya.com.ar mid-size terceros completo ranges per city (https://seguroya.com.ar/seguros-de-autos-precios) and cuantomecuesta.com (interior 0.60-0.75 of AMBA), against AMBA = 1.0 | Recompute the factors and add provinces that publish a range; the rest keep `default` |

### Patente model

The `patente` block of `config/calculadora.php` is a CENTRAL estimate (the other concepts are still a ceiling): the nominal 2026 annual tax of each jurisdiction, without early-payment or good-standing discounts. Monthly patente = annual / 12, rounded up to the step. Age = current year - model year (never negative). Each province has one rate scheme, the first that applies:

- `scale` (Buenos Aires, CABA): progressive. Each bracket is `{up_to, fixed, rate}` and the tax is `fixed + rate x (value - previous up_to)`. A value equal to a limit stays in the bracket that ends there.
- `bracket_rate` (Córdoba, Mendoza): one rate over the WHOLE value, chosen by the bracket the value falls in.
- `body_rate[utility]`: one rate for the utility bodies: pickups and SUVs (`utility_bodies`), unless the province sets its own `body_rate[province][utility_bodies]` (Misiones: pickups only, since the validation survey shows an SUV paying the car rate). Furgón, rural, sedán, hatchback and an unknown body type count as cars.
- `age_rate` (Santa Fe cars): one rate over the whole value by age band `{up_to_age, rate}`; an age equal to `up_to_age` stays in that band, and the last band (`null`) also covers the oldest cars.
- `body_rate[car]` (Misiones): one rate for every non-utility body type.
- `flat_rate` (every other province): one rate over the value. A province outside every map takes the MEDIAN flat rate.

`rules[province]` then adjusts the tax: `exempt_from_age` (that age or older pays nothing; "older than 20 years" is written 21), `surcharge` (fraction added on top), `cap` (maximum fraction of the value, after the surcharge) and `minimum` (ARS a year, last). Today: CABA +10%, 6% cap, 13,300 minimum, exempt from 25 years; Buenos Aires exempt from 25 years (the municipality collects cars of 10 to 24 years with the provincial calculation, so they keep paying it); Misiones exempt from 21 years; Neuquén exempt from 20 years.

- CPI: `up_to`, `fixed` and `minimum` are ARS amounts, multiplied by `max(1, CPI latest / CPI of the base month)`. The base month is `patente.cpi_base_month` (`2026-02`, ARBA) unless the province is in `patente.province_cpi_base_month` (CABA and Mendoza, `2026-01`: their 2026 laws apply from January). Rates, percentages, ages and age bands are never indexed.
- Base: the fixed ACARA catalog price (`FixedAcaraCatalog::priceFor`) of the vehicle's linked version (`acara_version_id`) for its model year, the value the provinces use as fiscal base. A USD catalog price is converted with the DolarApi sell quote that the estimate already uses. When there is no link, no usable price for that year (missing, null or not above zero), an empty catalog, or a USD price with no quote, the base is the listing price in ARS (a stand-in for the fiscal valuation). Only the patente changes: insurance, transfer and the budget comparison keep the listing price. `VehicleCostEstimate` passes `patente_base` to the pure `OwnershipCostCalculator`, which defaults it to the price.
- `breakdown.patente` reports `base`, `base_source` (`acara` or `listing`) and, only for `acara`, `reference_year` and `reference_currency`; `province`, `province_known`, `method` (`scale`, `bracket_rate`, `body_rate`, `age_rate`, `flat` or `exempt`), `rate`, `bracket_fixed`, `bracket_from`, `age`, `age_band` (`{from_age, to_age}` or null), `body_kind` (`utility`, `car` or null), `subtotal` (the tax before the rules), `surcharge`, `cap_rate`, `cap_applied`, `minimum`, `minimum_applied`, `exempt`, `exempt_from_age` and `annual`. The cost tooltip says "valor de referencia ACARA de esta versión" when the source is `acara`.
- Worked examples: a CABA 2022 car worth 38.985.600 pays 1.477.000 + 6,5% x (38.985.600 - 36.550.000) = 1.635.314, +10% = 1.798.845,4 a year (the 6% cap, 2.339.136, is not reached): 149.904 a month, rounded up to 150.000. A Misiones 2014 car worth 14.021.500 pays 2% = 280.430 a year: 23.369 a month, rounded up to 24.000. A Buenos Aires hatchback priced 20.600.000 falls in the 18.700.000-26.100.000 bracket: 233.000 + 3% x 1.900.000 = 290.000 a year, rounded up to 25.000 a month.

Review it once a year, together with `updated_at` and the base months:

| Value | Source | What to do |
| --- | --- | --- |
| Buenos Aires scale | ARBA 2026 scale, Infobae 2026-02-12 (https://www.infobae.com/economia/2026/02/12/confirmado-a-partir-de-marzo-las-patentes-bonaerenses-comenzaran-a-pagarse-todos-los-meses/) | Replace the brackets with the new scale and set `patente.cpi_base_month` to the month it is stated in |
| CABA scale and rules | Ley 6927 art. 50 (https://documentosboletinoficial.buenosaires.gob.ar/publico/PL-LEY-LCABA-LCBA-6927-25-ANX.pdf), exemptions Ámbito (https://www.ambito.com/economia/patentes-2026-que-vehiculos-estan-exentos-caba-y-cuales-empiezan-pagar-n6239557) | Replace the scale, surcharge, cap, minimum and exemption age with the new law and move `province_cpi_base_month.caba` |
| Mendoza brackets | Ley Impositiva 2026 (https://atm.mendoza.gov.ar/wp-content/uploads/2025/12/Ley-Impositiva-2026.pdf) | Replace the brackets and move `province_cpi_base_month.mendoza` |
| Misiones and Santa Fe | Ley XXII N 25 and RG 29/2025 (https://digestomisiones.gob.ar/archivospdf/1688643175_Ley%20XXII%20-%20N%2025.pdf), Santa Fe LIA arts. 55 a 58 (https://www.santafe.gov.ar/index.php/web/content/download/135407/669723/file/07%20LIA%20Patente%20%C3%9Anica%20sobre%20Veh%C3%ADculos%20(Art%C3%ADculos%2055%20a%2058).pdf) | Update `body_rate`, `age_rate` and the exemption age. Cars over 15 years in Santa Fe and over 16 in Misiones have a fixed amount in the law that was not found: they keep the last percentage band |
| Córdoba brackets | hacecuentas.com (unofficial). The 2026 brackets were not found and the values are about 2x the effective rates | Replace them with the provincial tax authority's brackets when found |
| `flat_rate` | UADE 2026 (https://uade.edu.ar/media/ibydidl3/uade-costo-patentes-de-automoviles.pdf) | Update the rates; move a province to another scheme when its rules are found. Chaco, Santa Cruz and Santiago del Estero have no data |

### Service model

The `service` block of `config/calculadora.php` replaces the old monthly maintenance (km x ARS per km). The service is an occasional cost: it is NOT part of the monthly total, it only enters the yearly one.

- Service per year = `services per year x price per service x fuel factor`, rounded up to the step.
- Services per year = `ceil(max(km per year / interval_km, 12 / interval_months))`. The km per month is the same one fuel uses (diagnostico answer, default, or the user's input), so changing the km on the screen changes both; with no km at all the time rule still asks for one service a year.
- Price per service (ARS, the average over one service cycle), looked up in this order: brand + model (`brands.<brand>.models`), then brand + body type (`brands.<brand>.body`), then `fallback.body`. An unknown or missing body type takes the highest fallback value; "Rural / familiar" maps to `rural`.
- Brand: matched on `vehiculo.marca` by its key or an alias (`vw` for Volkswagen), ignoring case and accents. Model: the longest configured model that appears as whole words in `vehiculo.modelo` ("Gol Trend" is `gol`, "Corolla Cross" is `corolla cross` and never `corolla`, "Golf" is never `gol`). `model_overrides` changes the interval of one model (the Amarok is every 10.000 km, the rest of Volkswagen every 15.000).
- Brands with data: Toyota (10.000 km, 12 months unconfirmed, base 2026-08), Volkswagen (15.000 km, base 2025-12), Fiat and Peugeot (10.000 km, base 2025-09). Fiat pickups and furgones, and every Peugeot body but the hatchback, use the fallback. BMW has no Argentine price or interval published, so it uses the fallback too. The `fallback` (10.000 km, 12 months, base 2025-09) is the old per-km value x 10.000.
- `fuel_factor`: nafta, diesel and hibrido 1.0; GNC 1.15 and electrico 0.5 are estimates without a source. An unknown fuel takes the highest factor. The service price does not depend on age.
- CPI: each brand and the fallback carry their own `cpi_base_month`; their prices are multiplied by `max(1, CPI latest / CPI of that month)`. Intervals and factors never are.
- Check: Toyota Yaris, 1.500 km a month: 18.000 km / 10.000 = 1,8 -> 2 services x 361.000 = 722.000 a year. A hatchback of an unlisted brand: 2 x 200.000 = 400.000 a year.

Review it once a year, together with `updated_at` and each `cpi_base_month`:

| Value | Source | What to do |
| --- | --- | --- |
| Toyota prices | Yacopini official list, Aug-2026 (https://toyotayacopini.com/servicio-de-posventa/) | Update `models` and `body`, confirm the 12-month interval and set the brand's `cpi_base_month` to the month of the list |
| Volkswagen prices | VW Mataderos list, undated (https://vwmataderos.com.ar/institucional/postventa/precios-de-servicio.htm) | Update the prices and set `cpi_base_month` to the month the list is read |
| Fiat and Peugeot prices | Infobae 2025-09-17 and La Nación 2025-10 (https://www.lanacion.com.ar/autos/servicie-oficial-del-auto-el-ranking-de-precios-de-las-automotrices-nid01102025/) | Recompute the prices and set their `cpi_base_month` |
| `fallback.body` | La Nación 2025-10 official service ranking (first services at 10.000 km) | Recompute the six values and set `fallback.cpi_base_month` |
| Other brands | Official price lists of each brand | Add a brand block (`label`, `aliases`, intervals, `cpi_base_month`, `models`, `body`) when a list is found |
| `fuel_factor` | Judgment | Change only if GNC or electric cars start to look wrong |
