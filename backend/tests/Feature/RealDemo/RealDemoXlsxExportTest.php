<?php

namespace Tests\Feature\RealDemo;

use App\Models\Concesionaria;
use App\Models\Vehiculo;
use App\Services\Catalog\FixedAcaraCatalog;
use App\Services\Inventario\VehiculoImportColumns;
use App\Services\Inventario\VehiculoXlsxReader;
use Database\Seeders\RealDemo\RealDemoInventory;
use Database\Seeders\Support\LocalAcaraCatalogData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * UH-05 demo data: `demo:reales-xlsx` writes one importable workbook per dealer for the develop import.
 */
class RealDemoXlsxExportTest extends TestCase
{
    use RefreshDatabase;

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(config('filesystems.vehicle_photos_disk'));
        $this->dir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'td-reales-xlsx-'.uniqid();
    }

    protected function tearDown(): void
    {
        foreach (glob($this->dir.DIRECTORY_SEPARATOR.'*') ?: [] as $file) {
            unlink($file);
        }
        if (is_dir($this->dir)) {
            rmdir($this->dir);
        }

        parent::tearDown();
    }

    /**
     * @return list<array<string, mixed>> the linked vehicles of a 60-vehicle run
     */
    private function linked(int $count = 60): array
    {
        return array_values(array_filter((new RealDemoInventory)->vehicles($count), fn (array $vehicle) => $vehicle['linked']));
    }

    public function test_it_writes_one_workbook_per_dealer_with_the_linked_vehicles_and_a_summary(): void
    {
        $this->artisan('demo:reales-xlsx', ['--cantidad' => 60, '--dir' => $this->dir])->assertExitCode(0);

        $linked = $this->linked();
        $perDealer = array_count_values(array_column($linked, 'dealer'));
        $summary = array_map('str_getcsv', file($this->dir.DIRECTORY_SEPARATOR.'dealers.csv', FILE_IGNORE_NEW_LINES));

        $this->assertSame(['slug', 'nombre', 'email', 'localidad', 'provincia', 'vehículos'], $summary[0]);
        $this->assertCount(1 + count($perDealer), $summary);
        foreach (array_slice($summary, 1) as [$slug, , $email, , , $total]) {
            $this->assertSame($slug.'@reales.tdautos.test', $email);
            $this->assertSame((string) $perDealer[$slug], $total);
            $this->assertFileExists($this->dir.DIRECTORY_SEPARATOR.$slug.'.xlsx');
            $this->assertLessThanOrEqual(2 * 1024 * 1024, filesize($this->dir.DIRECTORY_SEPARATOR.$slug.'.xlsx'));
        }
        $this->assertCount(count($perDealer) + 1, glob($this->dir.DIRECTORY_SEPARATOR.'*'));
    }

    public function test_a_workbook_holds_the_import_columns_as_text_with_yes_no_booleans_and_joined_photos(): void
    {
        $this->artisan('demo:reales-xlsx', ['--cantidad' => 60, '--dir' => $this->dir])->assertExitCode(0);

        $vehicle = $this->linked()[0];
        $rows = (new VehiculoXlsxReader)->read(file_get_contents($this->dir.DIRECTORY_SEPARATOR.$vehicle['dealer'].'.xlsx'));
        $data = collect($rows)->pluck('data')->firstWhere('patente', $vehicle['patente']);

        $this->assertSame(VehiculoImportColumns::headers(), array_keys($data));
        $this->assertSame($vehicle['marca'], $data['marca']);
        $this->assertSame($vehicle['version'], $data['version']);
        $this->assertSame($vehicle['carroceria'], $data['carroceria']);
        $this->assertSame(implode('|', $vehicle['fotos']), $data['fotos']);
        $this->assertContains($data['turbo'], ['sí', 'no']);
        $this->assertContains($data['frenos_abs'], ['sí', 'no']);
        $this->assertSame((string) $vehicle['precio'], $data['precio']);
    }

    public function test_a_workbook_previews_and_imports_without_errors_linking_the_catalog(): void
    {
        app(FixedAcaraCatalog::class)->import((new LocalAcaraCatalogData)->load());
        $this->artisan('demo:reales-xlsx', ['--cantidad' => 60, '--dir' => $this->dir])->assertExitCode(0);

        $slug = $this->linked()[0]['dealer'];
        $expected = array_values(array_filter($this->linked(), fn ($vehicle) => $vehicle['dealer'] === $slug));
        $user = Concesionaria::factory()->active()->create()->usuario;
        $content = file_get_contents($this->dir.DIRECTORY_SEPARATOR.$slug.'.xlsx');
        $file = fn () => UploadedFile::fake()->createWithContent($slug.'.xlsx', $content);

        $this->actingAs($user)->post('/api/concesionaria/vehiculos/importar/vista-previa', ['archivo' => $file()], ['Accept' => 'application/json'])
            ->assertOk()->assertExactJson(['nuevos' => count($expected), 'actualizaciones' => 0]);

        $this->actingAs($user)->post('/api/concesionaria/vehiculos/importar', ['archivo' => $file()], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame(count($expected), Vehiculo::query()->whereNotNull('acara_version_id')->count());
        foreach ($expected as $vehicle) {
            $this->assertTrue(Vehiculo::query()->where('acara_version_id', $vehicle['acara_version_id'])->where('anio', $vehicle['anio'])->exists());
        }
    }

    public function test_it_rejects_a_bad_amount_and_a_dealer_over_the_row_limit(): void
    {
        $this->artisan('demo:reales-xlsx', ['--cantidad' => 'many', '--dir' => $this->dir])
            ->expectsOutputToContain('--cantidad must be a whole number')->assertExitCode(1);

        // Row limit per workbook is VehiculoImportColumns::MAX_ROWS: 5,000 vehicles overflow the biggest dealers.
        $this->artisan('demo:reales-xlsx', ['--cantidad' => 5000, '--dir' => $this->dir])
            ->expectsOutputToContain((string) VehiculoImportColumns::MAX_ROWS)->assertExitCode(1);
        $this->assertDirectoryDoesNotExist($this->dir);
    }
}
