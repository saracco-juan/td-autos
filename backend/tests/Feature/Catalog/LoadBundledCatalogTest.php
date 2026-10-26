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
