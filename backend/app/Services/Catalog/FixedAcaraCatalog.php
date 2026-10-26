<?php

namespace App\Services\Catalog;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/** Permanent fixed data; only its derived read snapshot is disposable. */
final class FixedAcaraCatalog
{
    public const SOURCE_URL = 'https://api.acara.org.ar/api/v1/prices/download-vehicule-processed-pdf?file=acara_precios.pdf';

    public static function cacheKey(): string
    {
        $connection = DB::connection();
        // A local checkout may use several databases. Never cache credentials or cross their data.
        $identity = array_intersect_key($connection->getConfig(), array_flip([
            'driver', 'host', 'port', 'database', 'username', 'unix_socket', 'prefix', 'search_path',
        ]));

        return 'catalog.acara.fixed.v2:'.hash('sha256', json_encode([$connection->getName(), $identity], JSON_THROW_ON_ERROR));
    }

    public function current(): ?array
    {
        try {
            $cached = Cache::store('catalog')->get(self::cacheKey());
            if (is_array($cached)) {
                return $cached;
            }
        } catch (Throwable $error) {
            $this->cacheWarning($error);
        }
        $snapshot = $this->readDatabase();
        if ($snapshot !== null) {
            try {
                Cache::store('catalog')->put(self::cacheKey(), $snapshot, 300);
            } catch (Throwable $error) {
                $this->cacheWarning($error);
            }
        }

        return $snapshot;
    }

    /**
     * Catalog price of one version for one model year, read from the same snapshot as `current()`. Null when the
     * catalog is empty, the version is unknown or duplicated, or the year has no usable (null or non-positive) price.
     *
     * @return array{amount: float, currency: string}|null
     */
    public function priceFor(string $versionId, int $year): ?array
    {
        $rows = array_values(array_filter($this->current()['rows'] ?? [], fn (array $row) => $row['version_id'] === $versionId));
        // Duplicated references are not resolved by picking the first one (same rule as the resale scorer).
        if (count($rows) !== 1) {
            return null;
        }
        $amount = $rows[0]['values'][$year] ?? null;
        if ($amount === null || (float) $amount <= 0) {
            return null;
        }

        return ['amount' => (float) $amount, 'currency' => (string) $rows[0]['currency']];
    }

    /** Receives the existing reader's validated snapshot; never replaces fixed data. */
    public function import(array $snapshot): bool
    {
        $created = DB::transaction(function () use ($snapshot): bool {
            // Claim atomically, then compare the winner instead of racing a SELECT/INSERT.
            $claimed = DB::table('catalog_import')->insertOrIgnore(['id' => 1, 'source_date' => $snapshot['source_date'],
                'sha256' => $snapshot['sha256'], 'snapshot_id' => $snapshot['snapshot_id'], 'imported_at' => now()]);
            if ($claimed === 0) {
                $existing = DB::table('catalog_import')->find(1);
                if ($existing !== null && $existing->sha256 === $snapshot['sha256']) {
                    return false;
                }
                throw new RuntimeException('The fixed ACARA catalog is already loaded; replacement is not supported.');
            }
            $brands = $models = $versions = $prices = [];
            foreach ($snapshot['rows'] as $index => $row) {
                $brand = $brands[$row['make']] ??= DB::table('catalog_brands')->insertGetId(['name' => $row['make']]);
                $modelKey = json_encode([$brand, $row['model']], JSON_THROW_ON_ERROR);
                $model = $models[$modelKey] ??= DB::table('catalog_models')->insertGetId(['brand_id' => $brand, 'name' => $row['model']]);
                if (! isset($versions[$row['version_id']])) {
                    DB::table('catalog_versions')->insert(['id' => $row['version_id'], 'model_id' => $model, 'name' => $row['version']]);
                    $versions[$row['version_id']] = true;
                }
                foreach (['0km' => $row['zero_km_price']] + $row['values'] as $year => $amount) {
                    $prices[] = ['version_id' => $row['version_id'], 'source_row' => $index,
                        'source_page' => $row['page'], 'year' => (string) $year, 'currency' => $row['currency'], 'amount' => $amount];
                    if (count($prices) === 100) {
                        DB::table('catalog_prices')->insert($prices);
                        $prices = [];
                    }
                }
            }
            if ($prices) {
                DB::table('catalog_prices')->insert($prices);
            }

            return true;
        });
        // Only invalidate after successful persistence, including identical retries.
        try {
            Cache::store('catalog')->forget(self::cacheKey());
        } catch (Throwable $error) {
            $this->cacheWarning($error);
        }

        return $created;
    }

    private function readDatabase(): ?array
    {
        $metadata = DB::table('catalog_import')->find(1);
        if ($metadata === null) {
            return null;
        }
        $rows = [];
        $prices = DB::table('catalog_prices as p')
            ->join('catalog_versions as v', 'v.id', '=', 'p.version_id')
            ->join('catalog_models as m', 'm.id', '=', 'v.model_id')
            ->join('catalog_brands as b', 'b.id', '=', 'm.brand_id')
            ->select('p.*', 'v.name as version', 'm.name as model', 'b.name as make')
            ->orderBy('p.source_row')->orderBy('p.id')->get();
        foreach ($prices as $price) {
            $rows[$price->source_row] ??= ['make' => $price->make, 'model' => $price->model,
                'version' => $price->version, 'version_id' => $price->version_id,
                'currency' => $price->currency, 'page' => $price->source_page, 'zero_km_price' => null, 'values' => []];
            $amount = $price->amount === null ? null : $this->amount((string) $price->amount);
            if ($price->year === '0km') {
                $rows[$price->source_row]['zero_km_price'] = $amount;
            } else {
                $rows[$price->source_row]['values'][(int) $price->year] = $amount;
            }
        }

        return ['source_date' => $metadata->source_date, 'sha256' => $metadata->sha256,
            'snapshot_id' => $metadata->snapshot_id, 'rows' => array_values($rows),
            'source' => 'ACARA', 'source_url' => self::SOURCE_URL,
            'fetched_at' => CarbonImmutable::parse($metadata->imported_at)->toISOString()];
    }

    private function amount(string $value): string
    {
        return str_contains($value, '.') ? rtrim(rtrim($value, '0'), '.') : $value;
    }

    private function cacheWarning(Throwable $error): void
    {
        Log::warning('Local catalog cache unavailable; using permanent tables.', ['exception' => $error::class]);
    }
}
