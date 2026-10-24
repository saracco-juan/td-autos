# Fixed ACARA catalog

The fixed reference dataset lives in permanent database tables, not in cache.
`FixedAcaraCatalog` provides atomic initialization and a derived read snapshot.

## Storage

- `catalog_brands`, `catalog_models`, `catalog_versions` and `catalog_prices`
  store the hierarchy and prices; `catalog_import` is singleton provenance.
- Existing version IDs remain unchanged. Import never rewrites inventory.
- Source row numbers preserve conflicting curves instead of overwriting them.
  Missing prices remain null; model-year keys and 0km quotes remain separate.
- Repeating an identical checksum is a no-op, including an interleaved initializer.
  The singleton is claimed atomically before loading rows. A different dataset is rejected.
  Failure rolls back the whole initialization; there is no update/history workflow.
- PostgreSQL enables RLS and revokes direct `anon`/`authenticated` table access.
  Laravel's database owner connection serves the protected inventory API.

## Disposable local cache

The named `catalog` file store uses `storage/framework/cache/catalog`, independent
of the default cache driver. Its key is namespaced by database identity, without
passwords. A missing or failed cache falls back to permanent tables, without HTTP.
A warm read needs no catalog SQL; other request work may still query the database.
Entries expire after five minutes, so a manual database restore/reset cannot leave
an old snapshot authoritative indefinitely. Import and identical retries invalidate
the local entry after persistence succeeds. Other instances converge within five
minutes; clear their catalog caches during database maintenance for immediate visibility.
Expiration only reloads database rows: it never updates or downloads ACARA data.
Tests force an isolated array store or a disposable system-temp file store.

## One-time local import

Apply migrations to the intended database, then provide the selected real ACARA
PDF. No real catalog PDF is bundled. Never seed production from test fixtures.
Remote database operations require explicit authorization for that environment.

```powershell
cd backend
php artisan migrate
php -d memory_limit=512M artisan catalog:import-acara "C:\path\acara.pdf"
```

The command reads only a local file (maximum 25 MiB), using the existing validated
PDF reader. It never downloads a URL or replaces an initialized catalog.

| Input/result | Exit | Output |
| --- | --- | --- |
| First valid PDF | 0 | `ACARA catalog imported (N rows).` |
| Identical PDF | 0 | `ACARA catalog already loaded; no changes.` |
| Different PDF, invalid/future input, or storage failure | 1 | `ACARA catalog import failed: ...` |

Failures leave no partial dataset. Do not use migration rollback to update prices.
This command prepares fixed storage; the legacy source/scheduler switch is a
separate integration step. It does not change inventory, selectors or XLSX imports.

Offline regression: run `php -d memory_limit=512M vendor/bin/phpunit --filter
'FixedAcaraCatalogTest|ImportAcaraCatalogTest|AcaraPriceSourceTest' --no-progress`
from `backend`. Tests use isolated SQLite, synthetic PDF data and blocked HTTP.
