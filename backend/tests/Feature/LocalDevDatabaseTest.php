<?php

namespace Tests\Feature;

use App\Models\Concesionaria;
use App\Models\Vehiculo;
use App\Services\Catalog\FixedAcaraCatalog;
use App\Support\VehiculoFields;
use App\Support\VehiculoOptions;
use Database\Seeders\DemoDealersSeeder;
use Database\Seeders\Support\LocalAcaraCatalogData;
use Illuminate\Database\Connection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LocalDevDatabaseTest extends TestCase
{
    use RefreshDatabase;

    private string $path;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
        $this->path = sys_get_temp_dir().DIRECTORY_SEPARATOR.'td-local-'.uniqid().'.sqlite';
    }

    protected function tearDown(): void
    {
        DB::purge('local_dev_check');

        if (is_file($this->path)) {
            unlink($this->path);
        }

        parent::tearDown();
    }

    private function inspect(): Connection
    {
        config(['database.connections.local_dev_check' => [
            'driver' => 'sqlite',
            'database' => $this->path,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]]);
        DB::purge('local_dev_check');

        return DB::connection('local_dev_check');
    }

    public function test_existing_local_command_loads_the_full_fixed_catalog_offline(): void
    {
        Http::preventStrayRequests();
        $this->artisan('db:local', ['--path' => $this->path])->assertExitCode(0);
        $db = $this->inspect();
        $this->assertSame(1, $db->table('catalog_import')->count());
        $this->assertSame('2026-10-19', $db->table('catalog_import')->value('source_date'));
        $this->assertSame(115, $db->table('catalog_brands')->count());
        $this->assertSame(812, $db->table('catalog_models')->count());
        $this->assertSame(7383, $db->table('catalog_versions')->count());
        $this->assertSame(118240, $db->table('catalog_prices')->count());
        $this->assertGreaterThan(0, $db->table('catalog_prices')->whereNull('amount')->count());
        $this->assertSame(40, $db->table('modelo_referencia')->count());
        $corolla = 'acara:fe61f57616f218ce4b450c3562e6cf8fee5ac754b2e00d379aecf66212d156de';
        $this->assertSame('XEI 1.8 MT (140cv) (L14)', $db->table('catalog_versions')->where('id', $corolla)->value('name'));
        $this->assertEquals(17793100, $db->table('catalog_prices')->where('version_id', $corolla)->where('year', '2017')->value('amount'));
        $this->assertSame(4, $db->table('vehiculo_concesionaria')->count());
        $this->assertSame(28, $db->table('foto_vehiculo')->where('ubicacion_archivo', 'like', 'vehiculos/%')->count());
        $this->assertSame('sqlite', config('database.default'));
        $this->assertDatabaseCount('catalog_import', 0);
        $previous = config('database.default');
        config(['database.default' => 'local_dev_check']);
        try {
            $stored = app(FixedAcaraCatalog::class)->current();
            $expected = (new LocalAcaraCatalogData)->load();
            $this->assertSame(hash('sha256', json_encode($expected['rows'])), hash('sha256', json_encode($stored['rows'])));
        } finally {
            config(['database.default' => $previous]);
        }
    }

    #[DataProvider('unavailableCatalogs')]
    public function test_unavailable_bundled_catalog_preserves_an_existing_target(bool $corrupt): void
    {
        $original = database_path();
        $root = sys_get_temp_dir().DIRECTORY_SEPARATOR.'td-catalog-source-'.uniqid();
        $asset = $root.DIRECTORY_SEPARATOR.LocalAcaraCatalogData::ASSET;
        mkdir(dirname($asset), 0777, true);
        if ($corrupt) {
            file_put_contents($asset, 'not the trusted catalog');
        }
        file_put_contents($this->path, 'existing local database must survive');
        $this->app->useDatabasePath($root);
        try {
            $this->artisan('db:local', ['--path' => $this->path])
                ->expectsOutputToContain('Local ACARA catalog unavailable:')->assertExitCode(1);
            $this->assertSame('existing local database must survive', file_get_contents($this->path));
            $this->assertSame('sqlite', config('database.default'));
            $this->assertDatabaseCount('users', 0);
        } finally {
            $this->app->useDatabasePath($original);
            if (is_file($asset)) {
                unlink($asset);
            }
            rmdir(dirname($asset));
            rmdir($root.DIRECTORY_SEPARATOR.'seeders');
            rmdir($root);
        }
    }

    public static function unavailableCatalogs(): array
    {
        return ['missing' => [false], 'corrupt' => [true]];
    }

    public function test_it_builds_the_file_with_accounts_dealers_and_receipts(): void
    {
        $this->artisan('db:local', ['--path' => $this->path])
            ->expectsOutputToContain($this->path)
            ->expectsOutputToContain('DB_CONNECTION=sqlite')
            ->expectsOutputToContain('DB_URL=')
            ->expectsOutputToContain('admin@demo.tdautos.test')
            ->expectsOutputToContain(DemoDealersSeeder::DEMO_PASSWORD)
            ->assertExitCode(0);

        $this->assertFileExists($this->path);

        $db = $this->inspect();
        $admin = $db->table('users')->where('email', 'admin@demo.tdautos.test')->first();
        $buyer = $db->table('users')->where('email', 'comprador@demo.tdautos.test')->first();

        $this->assertSame('administrador', $admin->rol);
        $this->assertSame('comprador', $buyer->rol);
        $this->assertSame(7, $db->table('concesionaria')->count());
        $this->assertSame(2, $db->table('concesionaria')->where('estado_alta', 'activa')->count());
        $this->assertSame(6, $db->table('comprobante_pago')->count());
        $this->assertSame(
            3,
            $db->table('comprobante_pago')->where('revisado_por_admin_id', $admin->id)->count(),
        );
        $this->assertGreaterThan(0, $db->table('vehiculo')->count());
        $this->assertSame(4, $db->table('vehiculo_concesionaria')->count());
        $this->assertSame(28, $db->table('foto_vehiculo')->where('ubicacion_archivo', 'like', 'vehiculos/%')->count());
        foreach ($db->table('vehiculo')->where('origen', 'concesionaria')->get() as $vehicle) {
            // RF22/RF25: demo records must be editable and have real local images.
            $this->assertNotNull($vehicle->tipo_carroceria_id);
            $this->assertTrue($db->table('tipo_carroceria')->where('id', $vehicle->tipo_carroceria_id)->exists());
            $this->assertContains($vehicle->transmision, VehiculoOptions::TRANSMISION);
            $this->assertContains($vehicle->combustible, VehiculoOptions::COMBUSTIBLE);
        }
    }

    public function test_rf25_demo_photos_are_real_ordered_and_independently_owned(): void
    {
        $this->artisan('db:local', ['--path' => $this->path])->assertExitCode(0);
        $db = $this->inspect();
        $paths = [];
        foreach ($db->table('vehiculo_concesionaria')->get() as $ownership) {
            $photos = $db->table('foto_vehiculo')->where('vehiculo_id', $ownership->vehiculo_id)->orderBy('orden')->get();
            $this->assertSame(range(1, 7), $photos->pluck('orden')->all());
            foreach ($photos as $photo) {
                $this->assertStringStartsWith("vehiculos/{$ownership->vehiculo_id}/", $photo->ubicacion_archivo);
                Storage::disk('public')->assertExists($photo->ubicacion_archivo);
                $this->assertNotFalse(getimagesizefromstring(Storage::disk('public')->get($photo->ubicacion_archivo)));
                $paths[] = $photo->ubicacion_archivo;
            }
        }
        $this->assertCount(28, array_unique($paths));
    }

    public function test_demo_assets_stay_local_and_restore_the_configured_disks(): void
    {
        Storage::fake('remote_photos');
        Storage::fake('remote_receipts');
        config(['filesystems.vehicle_photos_disk' => 'remote_photos', 'filesystems.receipts_disk' => 'remote_receipts']);
        $this->artisan('db:local', ['--path' => $this->path])->assertExitCode(0);
        $this->assertCount(28, Storage::disk('public')->allFiles());
        $this->assertNotEmpty(Storage::disk('local')->allFiles());
        $this->assertSame([], Storage::disk('remote_photos')->allFiles());
        $this->assertSame([], Storage::disk('remote_receipts')->allFiles());
        $this->assertSame('remote_photos', config('filesystems.vehicle_photos_disk'));
        $this->assertSame('remote_receipts', config('filesystems.receipts_disk'));
    }

    public function test_rf22_seeded_dealer_vehicles_require_catalog_linkage_for_api_updates(): void
    {
        $this->artisan('db:local', ['--path' => $this->path])->assertExitCode(0);
        $this->inspect();
        $previous = config('database.default');
        config(['database.default' => 'local_dev_check']);
        try {
            foreach (Concesionaria::where('estado_alta', 'activa')->get() as $dealer) {
                foreach ($dealer->vehiculos()->with(['propiedad', 'fotos'])->get() as $vehicle) {
                    $url = '/api/concesionaria/vehiculos/'.$vehicle->id;
                    $this->actingAs($dealer->usuario)->getJson($url)->assertOk()
                        ->assertJsonPath('vehiculo.carroceria.id', $vehicle->tipo_carroceria_id)
                        ->assertJsonCount(7, 'vehiculo.fotos');
                    $fields = $vehicle->only(['marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio', 'transmision', 'combustible', 'ubicacion', 'descripcion']);
                    $fields['patente'] = $vehicle->propiedad->patente_normalizada;
                    $fields['carroceria_id'] = $vehicle->tipo_carroceria_id;
                    $fields['precio'] += 1000;
                    // HU05: editing a seeded vehicle must not require inventing missing facts.
                    $fields += $vehicle->only([
                        'moneda', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad',
                        'consumo_urbano', 'consumo_ruta', ...array_keys(VehiculoFields::EQUIPMENT_FIELDS),
                    ]);
                    if ($vehicle->acara_version_id === null) {
                        $before = $vehicle->getAttributes();
                        $this->postJson($url, $fields)->assertUnprocessable()->assertJsonValidationErrors('acara_version_id');
                        $this->assertSame($before, $vehicle->fresh()->getAttributes());

                        continue;
                    }
                    $this->postJson($url, $fields)->assertOk()->assertJsonCount(7, 'vehiculo.fotos')
                        ->assertJsonPath('vehiculo.plazas', 5)->assertJsonPath('vehiculo.turbo', $vehicle->turbo);
                    foreach ($fields as $field => $value) {
                        if (in_array($field, ['patente', 'carroceria_id'], true)) {
                            continue;
                        }
                        $this->assertEquals($value, $vehicle->fresh()->getAttribute($field), $field);
                    }
                    $this->assertSame($fields['precio'], Vehiculo::findOrFail($vehicle->id)->precio + 0);
                }
            }
        } finally {
            config(['database.default' => $previous]);
        }
    }

    public function test_running_twice_recreates_the_file_cleanly(): void
    {
        $this->artisan('db:local', ['--path' => $this->path])->assertExitCode(0);
        $first = $this->counts();
        $firstVehicles = $this->inspect()->table('vehiculo')->where('origen', 'concesionaria')->orderBy('id')->get()->toJson();
        DB::purge('local_dev_check');

        $this->artisan('db:local', ['--path' => $this->path])->assertExitCode(0);

        $this->assertSame($first, $this->counts());
        $this->assertSame($firstVehicles, $this->inspect()->table('vehiculo')->where('origen', 'concesionaria')->orderBy('id')->get()->toJson());
    }

    public function test_it_refuses_to_run_in_production(): void
    {
        $this->app['env'] = 'production';

        $this->artisan('db:local', ['--path' => $this->path])->assertExitCode(1);

        $this->assertFileDoesNotExist($this->path);
    }

    public function test_it_leaves_the_default_connection_untouched(): void
    {
        $this->artisan('db:local', ['--path' => $this->path])->assertExitCode(0);

        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseMissing('users', ['email' => 'admin@demo.tdautos.test']);
    }

    /**
     * @return array<string, int>
     */
    private function counts(): array
    {
        $db = $this->inspect();

        $counts = collect(['users', 'concesionaria', 'comprobante_pago', 'vehiculo', 'vehiculo_concesionaria', 'foto_vehiculo',
            'catalog_import', 'catalog_brands', 'catalog_models', 'catalog_versions', 'catalog_prices'])
            ->mapWithKeys(fn (string $table) => [$table => $db->table($table)->count()])
            ->all();

        // Release the file handle so the command can delete the file on Windows.
        DB::purge('local_dev_check');

        return $counts;
    }
}
