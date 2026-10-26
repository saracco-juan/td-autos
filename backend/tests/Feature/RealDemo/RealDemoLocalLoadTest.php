<?php

namespace Tests\Feature\RealDemo;

use App\Models\User;
use Database\Seeders\DemoDealersSeeder;
use Database\Seeders\RealDemo\RealDemoInventory;
use Illuminate\Database\Connection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * UH-05 demo data: `db:local --reales=N` loads the realistic inventory into the local SQLite file.
 */
class RealDemoLocalLoadTest extends TestCase
{
    use RefreshDatabase;

    private string $path;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
        $this->path = sys_get_temp_dir().DIRECTORY_SEPARATOR.'td-reales-'.uniqid().'.sqlite';
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

    public function test_it_creates_the_ten_dealers_and_the_requested_vehicles(): void
    {
        $this->artisan('db:local', ['--path' => $this->path, '--reales' => 60])
            ->expectsOutputToContain('@reales.tdautos.test')
            ->assertExitCode(0);

        $db = $this->inspect();
        $dealers = $db->table('users')->where('email', 'like', '%@reales.tdautos.test')->get();

        $this->assertCount(10, $dealers);
        $this->assertTrue(Hash::check(DemoDealersSeeder::DEMO_PASSWORD, $dealers->first()->password));
        $this->assertSame(User::ROL_CONCESIONARIA, $dealers->first()->rol);
        $this->assertSame(
            10,
            $db->table('concesionaria')->whereIn('usuario_id', $dealers->pluck('id'))->where('estado_alta', 'activa')->count(),
        );
        $this->assertSame(
            10,
            $db->table('suscripcion')->where('estado', 'activa')->whereIn('concesionaria_id', $db->table('concesionaria')->whereIn('usuario_id', $dealers->pluck('id'))->pluck('id'))->count(),
        );
        $this->assertEqualsCanonicalizing(
            array_column(RealDemoInventory::DEALERS, 'provincia'),
            $db->table('concesionaria')->whereIn('usuario_id', $dealers->pluck('id'))->pluck('provincia')->all(),
        );

        $new = $db->table('vehiculo_concesionaria')->whereIn('concesionaria_id', $db->table('concesionaria')->whereIn('usuario_id', $dealers->pluck('id'))->pluck('id'));
        $this->assertSame(60, (clone $new)->count());
        $this->assertSame(60, (clone $new)->where('visible', true)->count());
        $this->assertSame(60 * 7, $db->table('foto_vehiculo')->where('ubicacion_archivo', 'like', 'https://%')->count());
    }

    public function test_linked_vehicles_carry_their_acara_version_and_unlinked_ones_keep_the_text(): void
    {
        $this->artisan('db:local', ['--path' => $this->path, '--reales' => 60])->assertExitCode(0);
        $db = $this->inspect();

        $expected = (new RealDemoInventory)->vehicles(60);
        $vehicles = $db->table('vehiculo')->whereIn('id', $db->table('vehiculo_concesionaria')->whereIn('patente_normalizada', array_column($expected, 'patente'))->pluck('vehiculo_id'))->get()->keyBy('id');
        $this->assertCount(60, $vehicles);

        $ids = $db->table('vehiculo_concesionaria')->whereIn('patente_normalizada', array_column($expected, 'patente'))->pluck('vehiculo_id', 'patente_normalizada');
        $unlinked = 0;
        foreach ($expected as $vehicle) {
            $row = $vehicles[$ids[$vehicle['patente']]];
            $this->assertSame([$vehicle['marca'], $vehicle['modelo'], $vehicle['version']], [$row->marca, $row->modelo, $row->version]);
            $this->assertSame($vehicle['linked'] ? $vehicle['acara_version_id'] : null, $row->acara_version_id);
            $this->assertEquals($vehicle['precio'], $row->precio);
            $this->assertSame('concesionaria', $row->origen);
            if ($vehicle['linked']) {
                $this->assertTrue($db->table('catalog_versions')->where('id', $row->acara_version_id)->exists());
            } else {
                $unlinked++;
            }
        }
        $this->assertGreaterThan(0, $unlinked);
        $this->assertLessThan(60, $unlinked);
    }

    public function test_it_composes_with_the_volume_option(): void
    {
        $this->artisan('db:local', ['--path' => $this->path, '--reales' => 20, '--vehiculos' => 30])->assertExitCode(0);
        $db = $this->inspect();

        $this->assertSame(10, $db->table('users')->where('email', 'like', '%@reales.tdautos.test')->count());
        $this->assertGreaterThan(0, $db->table('users')->where('email', 'like', '%@volumen.tdautos.test')->count());
        $this->assertSame(20 + 30 + 4, $db->table('vehiculo_concesionaria')->count());
        $this->assertSame($db->table('vehiculo_concesionaria')->count(), $db->table('vehiculo_concesionaria')->distinct()->count('patente_normalizada'));
    }

    public function test_it_rejects_an_invalid_amount_without_touching_the_target(): void
    {
        file_put_contents($this->path, 'existing local database must survive');

        $this->artisan('db:local', ['--path' => $this->path, '--reales' => 'many'])
            ->expectsOutputToContain('--reales must be a whole number')
            ->assertExitCode(1);

        $this->assertSame('existing local database must survive', file_get_contents($this->path));
    }
}
