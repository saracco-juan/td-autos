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

    private function snapshot(string $date = '19/10/2026'): array
    {
        return app(AcaraPriceReader::class)->read(AcaraPdf::make($date));
    }
}
