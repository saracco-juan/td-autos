<?php

namespace Tests\Feature;

use App\Models\Concesionaria;
use App\Models\TipoCarroceria;
use App\Models\User;
use App\Models\Vehiculo;
use App\Support\Patente;
use App\Support\VehiculoFotos;
use App\Support\VehiculoOptions;
use Database\Seeders\DemoDealersSeeder;
use Database\Seeders\VolumeInventorySeeder;
use Illuminate\Database\Connection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * `db:local --vehiculos=N`: thousands of dealer vehicles for manual testing at volume.
 */
class VolumeInventorySeedTest extends TestCase
{
    use RefreshDatabase;

    private const VOLUME = 120;

    private string $path;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(config('filesystems.receipts_disk'));
        Storage::fake(config('filesystems.vehicle_photos_disk'));
        $this->path = sys_get_temp_dir().DIRECTORY_SEPARATOR.'td-volume-'.uniqid().'.sqlite';
    }

    protected function tearDown(): void
    {
        DB::purge('local_dev_check');

        if (is_file($this->path)) {
            unlink($this->path);
        }

        parent::tearDown();
    }

    private function seedVolume(int $vehicles = self::VOLUME): void
    {
        app(VolumeInventorySeeder::class)->withVehicles($vehicles)->run();
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

    public function test_the_vehicle_factory_uses_canonical_values_and_a_real_body_type(): void
    {
        $vehicles = Vehiculo::factory()->count(20)->create();

        foreach ($vehicles as $vehicle) {
            $this->assertContains($vehicle->combustible, VehiculoOptions::COMBUSTIBLE);
            $this->assertContains($vehicle->transmision, VehiculoOptions::TRANSMISION);
            $this->assertNotNull($vehicle->tipo_carroceria_id);
            $this->assertNotNull($vehicle->tipoCarroceria);
        }
    }

    public function test_it_creates_exactly_the_requested_vehicles_for_active_dealers_with_a_current_subscription(): void
    {
        $this->seedVolume();

        $this->assertSame(self::VOLUME, DB::table('vehiculo')->count());
        $this->assertSame(self::VOLUME, DB::table('vehiculo_concesionaria')->count());
        $this->assertGreaterThan(7, Concesionaria::where('estado_alta', Concesionaria::ESTADO_ACTIVA)->count());

        $unowned = DB::table('vehiculo_concesionaria as vc')
            ->join('concesionaria as c', 'c.id', '=', 'vc.concesionaria_id')
            ->join('suscripcion as s', 's.concesionaria_id', '=', 'c.id')
            ->where('c.estado_alta', 'activa')
            ->where('s.estado', 'activa')
            ->where('s.vigente_hasta', '>=', now()->toDateString())
            ->count();
        $this->assertSame(self::VOLUME, $unowned);
        $this->assertSame(self::VOLUME, DB::table('vehiculo_concesionaria')->where('visible', true)->count());
    }

    public function test_dealers_are_volume_accounts_with_the_demo_password_and_spread_unevenly(): void
    {
        $this->seedVolume(1000);

        $emails = DB::table('users')->where('rol', 'concesionaria')->pluck('email');
        $this->assertCount(50, $emails);
        $this->assertTrue($emails->every(fn (string $email) => str_ends_with($email, '@volumen.tdautos.test')));
        $this->assertContains('concesionaria01@volumen.tdautos.test', $emails->all());

        $user = User::where('email', 'concesionaria01@volumen.tdautos.test')->first();
        $this->assertTrue(Hash::check(DemoDealersSeeder::DEMO_PASSWORD, $user->password));

        $perDealer = DB::table('vehiculo_concesionaria')
            ->selectRaw('concesionaria_id, count(*) as total')
            ->groupBy('concesionaria_id')
            ->pluck('total');
        $this->assertGreaterThan(5 * $perDealer->min(), $perDealer->max());
    }

    public function test_vehicles_have_realistic_canonical_values(): void
    {
        $this->seedVolume();

        $bodyTypes = TipoCarroceria::pluck('id')->all();

        foreach (Vehiculo::all() as $vehicle) {
            $this->assertSame('concesionaria', $vehicle->origen);
            $this->assertContains($vehicle->combustible, VehiculoOptions::COMBUSTIBLE);
            $this->assertContains($vehicle->transmision, VehiculoOptions::TRANSMISION);
            $this->assertContains($vehicle->tipo_carroceria_id, $bodyTypes);
            $this->assertSame(VehiculoOptions::MONEDA, $vehicle->moneda);
            $this->assertGreaterThanOrEqual(2008, $vehicle->anio);
            $this->assertLessThanOrEqual(2025, $vehicle->anio);
            $this->assertGreaterThanOrEqual(0, $vehicle->kilometraje);
            $this->assertLessThanOrEqual((2026 - $vehicle->anio + 1) * 20000, $vehicle->kilometraje);
            $this->assertGreaterThanOrEqual(1500000, (float) $vehicle->precio);
            $this->assertLessThanOrEqual(150000000, (float) $vehicle->precio);
            $this->assertNotEmpty($vehicle->descripcion);
            $this->assertNotEmpty($vehicle->ubicacion);
        }
    }

    public function test_vehicles_sit_in_their_dealers_town(): void
    {
        $this->seedVolume();

        $mismatches = DB::table('vehiculo_concesionaria as vc')
            ->join('vehiculo as v', 'v.id', '=', 'vc.vehiculo_id')
            ->join('concesionaria as c', 'c.id', '=', 'vc.concesionaria_id')
            ->whereColumn('v.ubicacion', '!=', 'c.localidad')
            ->count();

        $this->assertSame(0, $mismatches);
    }

    public function test_plates_are_unique_normalized_and_mix_both_formats(): void
    {
        $this->seedVolume();

        $plates = DB::table('vehiculo_concesionaria')->pluck('patente_normalizada');

        $this->assertCount(self::VOLUME, $plates->unique());
        $this->assertTrue($plates->every(fn (string $plate) => Patente::isValid($plate) && $plate === Patente::normalize($plate)));
        $this->assertTrue($plates->contains(fn (string $plate) => preg_match('/\A[A-Z]{3}[0-9]{3}\z/', $plate) === 1));
        $this->assertTrue($plates->contains(fn (string $plate) => preg_match('/\A[A-Z]{2}[0-9]{3}[A-Z]{2}\z/', $plate) === 1));
    }

    public function test_every_vehicle_has_the_minimum_photos_pointing_at_files_that_exist(): void
    {
        $this->seedVolume();

        $perVehicle = DB::table('foto_vehiculo')
            ->selectRaw('vehiculo_id, count(*) as total, min(orden) as first, max(orden) as last')
            ->groupBy('vehiculo_id')
            ->get();

        $this->assertCount(self::VOLUME, $perVehicle);
        $this->assertTrue($perVehicle->every(
            fn ($row) => (int) $row->total === VehiculoOptions::FOTOS_MINIMO
                && (int) $row->first === 1
                && (int) $row->last === VehiculoOptions::FOTOS_MINIMO,
        ));

        foreach (DB::table('foto_vehiculo')->distinct()->pluck('ubicacion_archivo') as $location) {
            $this->assertFalse(VehiculoFotos::isExternal($location));
            VehiculoFotos::disk()->assertExists($location);
            $this->assertStringStartsWith("\x89PNG", VehiculoFotos::disk()->get($location));
        }
    }

    public function test_the_same_volume_twice_gives_identical_data(): void
    {
        $this->seedVolume();
        $first = $this->fingerprint();

        DB::table('foto_vehiculo')->delete();
        DB::table('vehiculo_concesionaria')->delete();
        DB::table('vehiculo')->delete();
        DB::table('suscripcion')->delete();
        DB::table('concesionaria')->delete();
        DB::table('users')->delete();

        $this->seedVolume();

        $this->assertSame($first, $this->fingerprint());
    }

    public function test_a_volume_dealer_lists_its_inventory_through_the_existing_endpoint(): void
    {
        $this->seedVolume();

        $dealer = Concesionaria::whereHas('usuario', fn ($q) => $q->where('email', 'concesionaria01@volumen.tdautos.test'))->firstOrFail();
        $expected = DB::table('vehiculo_concesionaria')->where('concesionaria_id', $dealer->id)->count();

        $this->actingAs($dealer->usuario)
            ->getJson('/api/concesionaria/vehiculos')
            ->assertOk()
            ->assertJsonCount($expected, 'vehiculos');
    }

    public function test_the_command_loads_the_volume_on_top_of_the_demo_seed(): void
    {
        $this->artisan('db:local', ['--path' => $this->path, '--vehiculos' => self::VOLUME])
            ->expectsOutputToContain((string) self::VOLUME)
            ->assertExitCode(0);

        $db = $this->inspect();

        // 7 demo dealers plus the volume ones; 2 demo vehicles per active demo dealer plus the volume.
        $this->assertGreaterThan(50, $db->table('concesionaria')->count());
        $this->assertSame(4 + self::VOLUME, $db->table('vehiculo_concesionaria')->count());
        $this->assertSame(7 * (4 + self::VOLUME), $db->table('foto_vehiculo')->count());
    }

    public function test_without_the_option_the_seed_is_the_small_one(): void
    {
        $this->artisan('db:local', ['--path' => $this->path])->assertExitCode(0);

        $db = $this->inspect();
        $this->assertSame(7, $db->table('concesionaria')->count());
        $this->assertSame(4, $db->table('vehiculo_concesionaria')->count());
    }

    public function test_zero_vehicles_is_the_same_as_no_option(): void
    {
        $this->artisan('db:local', ['--path' => $this->path, '--vehiculos' => 0])->assertExitCode(0);

        $this->assertSame(7, $this->inspect()->table('concesionaria')->count());
    }

    public function test_an_invalid_amount_fails_without_building_the_file(): void
    {
        foreach (['-1', 'abc', '1.5'] as $value) {
            $this->artisan('db:local', ['--path' => $this->path, '--vehiculos' => $value])->assertExitCode(1);
        }

        $this->assertFileDoesNotExist($this->path);
    }

    private function fingerprint(): string
    {
        $vehicles = DB::table('vehiculo as v')
            ->join('vehiculo_concesionaria as vc', 'vc.vehiculo_id', '=', 'v.id')
            ->orderBy('vc.patente_normalizada')
            ->get(['vc.patente_normalizada', 'v.marca', 'v.modelo', 'v.version', 'v.anio', 'v.kilometraje', 'v.precio', 'v.combustible', 'v.transmision', 'v.ubicacion', 'v.descripcion', 'v.tipo_carroceria_id'])
            ->toJson();
        $dealers = DB::table('concesionaria')->orderBy('nombre')->get(['nombre', 'localidad', 'provincia'])->toJson();

        return md5($vehicles.$dealers);
    }
}
