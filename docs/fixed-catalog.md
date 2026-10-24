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
