<?php

namespace Tests\Feature\Resale;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Fixtures\AcaraPdf;
use Tests\TestCase;

class ImportAcaraCatalogTest extends TestCase
{
    use RefreshDatabase;

    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->directory = sys_get_temp_dir().'/catalog-import-test-'.bin2hex(random_bytes(8));
        mkdir($this->directory);
        Http::preventStrayRequests();
        $this->travelTo(now()->parse('2026-10-24T12:00:00Z'));
    }

    protected function tearDown(): void
    {
        Http::assertNothingSent();
        File::deleteDirectory($this->directory);
        parent::tearDown();
    }

    public function test_local_import_succeeds_once_and_never_replaces_existing_data(): void
    {
        $path = $this->directory.'/catalog.pdf';
        file_put_contents($path, AcaraPdf::make());
        $this->artisan('catalog:import-acara', ['path' => $path])
            ->expectsOutput('ACARA catalog imported (2 rows).')->assertSuccessful();
        $this->artisan('catalog:import-acara', ['path' => $path])
            ->expectsOutput('ACARA catalog already loaded; no changes.')->assertSuccessful();
        $before = DB::table('catalog_prices')->orderBy('id')->get()->toJson();
        file_put_contents($path, AcaraPdf::make('20/10/2026'));
        $this->artisan('catalog:import-acara', ['path' => $path])
            ->expectsOutput('ACARA catalog import failed: The fixed ACARA catalog is already loaded; replacement is not supported.')
            ->assertFailed();
        $this->assertSame($before, DB::table('catalog_prices')->orderBy('id')->get()->toJson());
        $this->assertDatabaseCount('catalog_import', 1);
        $this->assertDatabaseCount('vehiculo', 0);
    }

    #[DataProvider('invalidInputs')]
    public function test_invalid_input_leaves_all_tables_empty(string $case): void
    {
        $path = $this->directory.'/input.pdf';
        if ($case !== 'missing') {
            file_put_contents($path, match ($case) {
                'future' => AcaraPdf::make('25/10/2026'),
                'oversized' => str_repeat('x', 25 * 1024 * 1024 + 1),
                default => 'not a PDF',
            });
        }
        $this->artisan('catalog:import-acara', ['path' => $path])->assertFailed();
        $this->assertEmptyTables();
    }

    public static function invalidInputs(): array
    {
        return array_map(fn ($case) => [$case], ['missing', 'invalid', 'oversized', 'future']);
    }

    public function test_storage_failure_returns_failure_without_partial_import(): void
    {
        $path = $this->directory.'/catalog.pdf';
        file_put_contents($path, AcaraPdf::make());
        DB::listen(function ($query): void {
            if (str_starts_with($query->sql, 'insert into "catalog_prices"')) {
                throw new RuntimeException('Simulated price write failure.');
            }
        });
        $this->artisan('catalog:import-acara', ['path' => $path])
            ->expectsOutput('ACARA catalog import failed: Simulated price write failure.')->assertFailed();
        $this->assertEmptyTables();
    }

    private function assertEmptyTables(): void
    {
        foreach (['catalog_import', 'catalog_brands', 'catalog_models', 'catalog_versions', 'catalog_prices'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
    }
}
