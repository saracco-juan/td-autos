<?php

namespace Tests\Feature\Resale;

use App\Services\Catalog\FixedAcaraCatalog;
use App\Services\Resale\AcaraPriceReader;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\Fixtures\AcaraPdf;
use Tests\TestCase;

class FixedAcaraCatalogTest extends TestCase
{
    use RefreshDatabase;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->directory = sys_get_temp_dir().'/fixed-catalog-test-'.bin2hex(random_bytes(8));
        mkdir($this->directory);
        config(['cache.stores.catalog' => ['driver' => 'file', 'path' => $this->directory.'/cache']]);
        Http::preventStrayRequests();
    }

    protected function tearDown(): void
    {
        Http::assertNothingSent();
        File::deleteDirectory($this->directory);
        parent::tearDown();
    }

    public function test_persistence_preserves_duplicate_rows_year_keys_and_price_gaps(): void
    {
        $catalog = app(FixedAcaraCatalog::class);
        $snapshot = $this->snapshot();
        $this->assertNull($catalog->current());
        $this->assertTrue($catalog->import($snapshot));
        $this->assertDatabaseCount('catalog_import', 1);
        $this->assertDatabaseCount('catalog_brands', 1);
        $this->assertDatabaseCount('catalog_models', 1);
        $this->assertDatabaseCount('catalog_versions', 1);
        $this->assertDatabaseCount('catalog_prices', 6);
        $first = $catalog->current();
        Cache::store('catalog')->flush();
        $this->assertSame($first, $catalog->current());
        $this->assertSame($snapshot['rows'], $first['rows']);
        $this->assertDatabaseCount('vehiculo', 0);
    }

    public function test_repeated_import_is_idempotent_and_replacement_preserves_all_rows(): void
    {
        $catalog = app(FixedAcaraCatalog::class);
        $catalog->import($this->snapshot());
        $this->assertFalse($catalog->import($this->snapshot()));
        $expected = $catalog->current();
        try {
            $catalog->import($this->snapshot('20/10/2026'));
            $this->fail('Replacement was accepted.');
        } catch (RuntimeException $error) {
            $this->assertStringContainsString('replacement is not supported', $error->getMessage());
        }
        Cache::store('catalog')->flush();
        $this->assertSame($expected, $catalog->current());
        $this->assertDatabaseCount('catalog_prices', 6);
    }

    public function test_failed_persistence_rolls_back_the_entire_import(): void
    {
        DB::listen(function ($query): void {
            if (str_starts_with($query->sql, 'insert into "catalog_prices"')) {
                throw new RuntimeException('Simulated price write failure.');
            }
        });
        try {
            app(FixedAcaraCatalog::class)->import($this->snapshot());
            $this->fail('Simulated failure was ignored.');
        } catch (RuntimeException $error) {
            $this->assertSame('Simulated price write failure.', $error->getMessage());
        }
        foreach (['catalog_import', 'catalog_brands', 'catalog_models', 'catalog_versions', 'catalog_prices'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
    }

    public function test_warm_local_cache_does_not_query_the_database_even_with_database_default_cache(): void
    {
        config(['cache.default' => 'database']);
        $catalog = app(FixedAcaraCatalog::class);
        $catalog->import($this->snapshot());
        $expected = $catalog->current();
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->assertSame($expected, $catalog->current());
        $this->assertSame([], DB::getQueryLog());
        DB::disableQueryLog();
    }

    public function test_unavailable_cache_falls_back_to_persisted_tables(): void
    {
        $catalog = app(FixedAcaraCatalog::class);
        $catalog->import($this->snapshot());
        $expected = $catalog->current();
        Cache::shouldReceive('store')->with('catalog')->andThrow(new RuntimeException('Cache unavailable.'));
        $this->assertSame($expected, $catalog->current());
    }

    public function test_local_cache_cannot_cross_database_connections(): void
    {
        app(FixedAcaraCatalog::class)->import($this->snapshot());
        app(FixedAcaraCatalog::class)->current();
        $original = DB::getDefaultConnection();
        $key = FixedAcaraCatalog::cacheKey();
        config(['database.connections.catalog_probe' => config('database.connections.'.$original)]);
        try {
            DB::setDefaultConnection('catalog_probe');
            $this->assertNotSame($key, FixedAcaraCatalog::cacheKey());
            $this->assertNull(Cache::store('catalog')->get(FixedAcaraCatalog::cacheKey()));
        } finally {
            DB::setDefaultConnection($original);
        }
    }

    public function test_import_and_identical_retry_discard_a_stale_local_snapshot(): void
    {
        $catalog = app(FixedAcaraCatalog::class);
        foreach ([true, false] as $created) {
            Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), ['snapshot_id' => 'obsolete']);
            $this->assertSame($created, $catalog->import($this->snapshot()));
            $this->assertSame($this->snapshot()['snapshot_id'], $catalog->current()['snapshot_id']);
        }
        $this->assertDatabaseCount('catalog_prices', 6);
    }

    public function test_cached_snapshot_expires_after_database_reset(): void
    {
        $catalog = app(FixedAcaraCatalog::class);
        $catalog->import($this->snapshot());
        $this->assertNotNull($catalog->current());
        foreach (['catalog_prices', 'catalog_versions', 'catalog_models', 'catalog_brands', 'catalog_import'] as $table) {
            DB::table($table)->delete();
        }
        $this->travel(301)->seconds();
        $this->assertNull($catalog->current());
    }

    public function test_an_interleaved_initializer_with_the_same_checksum_is_a_noop(): void
    {
        $snapshot = $this->snapshot();
        $interleaved = false;
        $winner = null;
        DB::connection()->beforeExecuting(function ($sql) use ($snapshot, &$interleaved, &$winner): void {
            if (! $interleaved && str_starts_with($sql, 'insert') && str_contains($sql, '"catalog_import"')) {
                $interleaved = true;
                $winner = app(FixedAcaraCatalog::class)->import($snapshot);
            }
        });
        $this->assertFalse(app(FixedAcaraCatalog::class)->import($snapshot));
        $this->assertTrue($winner);
        $this->assertDatabaseCount('catalog_import', 1);
        $this->assertDatabaseCount('catalog_prices', 6);
        $this->assertSame($snapshot['sha256'], DB::table('catalog_import')->value('sha256'));
    }

    public function test_it_answers_the_price_of_a_version_for_a_model_year(): void
    {
        $catalog = app(FixedAcaraCatalog::class);
        $this->assertNull($catalog->priceFor('acara:v', 2022));
        $catalog->import($this->row(['2022' => '1500.50', '2021' => null, '2020' => '0']));

        $this->assertSame(['amount' => 1500.5, 'currency' => 'USD'], $catalog->priceFor('acara:v', 2022));
        $this->assertNull($catalog->priceFor('acara:v', 2021));
        $this->assertNull($catalog->priceFor('acara:v', 2020));
        $this->assertNull($catalog->priceFor('acara:v', 2019));
        $this->assertNull($catalog->priceFor('acara:other', 2022));
    }

    /** @param array<int|string, ?string> $values */
    private function row(array $values): array
    {
        return ['source_date' => '2026-10-19', 'sha256' => hash('sha256', 'price'), 'snapshot_id' => 'price-1',
            'rows' => [['make' => 'M', 'model' => 'X', 'version' => 'V', 'version_id' => 'acara:v', 'currency' => 'USD',
                'page' => 1, 'zero_km_price' => null, 'values' => $values]]];
    }

    private function snapshot(string $date = '19/10/2026'): array
    {
        return app(AcaraPriceReader::class)->read(AcaraPdf::make($date));
    }
}
