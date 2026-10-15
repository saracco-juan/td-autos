<?php

namespace Tests\Feature;

use Database\Seeders\DemoDealersSeeder;
use Illuminate\Database\Connection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LocalDevDatabaseTest extends TestCase
{
    use RefreshDatabase;

    private string $path;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(config('filesystems.receipts_disk'));
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

    public function test_it_builds_the_file_with_accounts_dealers_and_receipts(): void
    {
        $this->artisan('db:local', ['--path' => $this->path])
            ->expectsOutputToContain($this->path)
            ->expectsOutputToContain('DB_CONNECTION=sqlite')
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
    }

    public function test_running_twice_recreates_the_file_cleanly(): void
    {
        $this->artisan('db:local', ['--path' => $this->path])->assertExitCode(0);
        $first = $this->counts();

        $this->artisan('db:local', ['--path' => $this->path])->assertExitCode(0);

        $this->assertSame($first, $this->counts());
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

        $counts = collect(['users', 'concesionaria', 'comprobante_pago', 'vehiculo', 'vehiculo_concesionaria', 'foto_vehiculo'])
            ->mapWithKeys(fn (string $table) => [$table => $db->table($table)->count()])
            ->all();

        // Release the file handle so the command can delete the file on Windows.
        DB::purge('local_dev_check');

        return $counts;
    }
}
