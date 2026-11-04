<?php

namespace Tests\Feature\Catalog;

use App\Services\Catalog\FixedAcaraCatalog;
use Database\Seeders\Support\LocalAcaraCatalogData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The deploy loads the bundled fixed catalog once, so an environment without the ACARA PDF still has a catalog.
 */
class LoadBundledCatalogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::store('catalog')->flush();
    }

    public function test_an_empty_database_gets_the_bundled_catalog(): void
    {
        $this->artisan('catalog:load-bundled')
            ->expectsOutputToContain('Bundled ACARA catalog loaded')
            ->assertSuccessful();

        $expected = (new LocalAcaraCatalogData)->load();
        $this->assertSame($expected['sha256'], DB::table('catalog_import')->value('sha256'));
        $this->assertNotNull(app(FixedAcaraCatalog::class)->current());
    }

    public function test_the_bundled_catalog_loads_with_batched_inserts(): void
    {
        // Each round trip to the deployed database costs tens of milliseconds: one insert per version or per
        // hundred prices made the first container start take minutes.
        DB::enableQueryLog();
        $this->artisan('catalog:load-bundled')->assertSuccessful();
        $inserts = collect(DB::getQueryLog())->filter(fn (array $query) => str_starts_with(strtolower(ltrim($query['query'])), 'insert'));

        $this->assertLessThan(400, $inserts->count());
        $rows = collect((new LocalAcaraCatalogData)->load()['rows']);
        $this->assertSame($rows->pluck('version_id')->unique()->count(), DB::table('catalog_versions')->count());
        $this->assertSame($rows->sum(fn (array $row) => 1 + count($row['values'])), DB::table('catalog_prices')->count());
    }

    public function test_a_second_run_changes_nothing(): void
    {
        $this->artisan('catalog:load-bundled')->assertSuccessful();
        $prices = DB::table('catalog_prices')->count();

        $this->artisan('catalog:load-bundled')
            ->expectsOutputToContain('already loaded')
            ->assertSuccessful();

        $this->assertSame($prices, DB::table('catalog_prices')->count());
    }

    public function test_another_catalog_already_loaded_is_kept(): void
    {
        DB::table('catalog_import')->insert(['id' => 1, 'source_date' => '2026-11-02', 'sha256' => str_repeat('a', 64),
            'snapshot_id' => 'other', 'imported_at' => now()]);

        $this->artisan('catalog:load-bundled')
            ->expectsOutputToContain('another catalog is already loaded')
            ->assertSuccessful();

        $this->assertSame('other', DB::table('catalog_import')->value('snapshot_id'));
        $this->assertSame(0, DB::table('catalog_prices')->count());
    }

    public function test_an_unreadable_bundle_fails_without_touching_the_database(): void
    {
        $this->artisan('catalog:load-bundled', ['--path' => base_path('missing-catalog.json.gz')])
            ->expectsOutputToContain('Bundled ACARA catalog not loaded')
            ->assertFailed();

        $this->assertSame(0, DB::table('catalog_import')->count());
    }
}
