<?php

namespace Tests\Feature\RealDemo;

use App\Models\Vehiculo;
use App\Services\Catalog\FixedAcaraCatalog;
use Database\Seeders\RealDemo\RealDemoDealers;
use Database\Seeders\RealDemo\RealDemoInventory;
use Database\Seeders\Support\LocalAcaraCatalogData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Console\Output\BufferedOutput;
use Tests\TestCase;

/**
 * UH-05 demo data: `demo:reales-importar` feeds the `demo:reales-xlsx` workbooks through the app's own
 * import (preview, then apply) as each demo dealer, so a deployed database needs no UI clicks.
 */
class RealDemoImportCommandTest extends TestCase
{
    use RefreshDatabase;

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(config('filesystems.vehicle_photos_disk'));
        app(FixedAcaraCatalog::class)->import((new LocalAcaraCatalogData)->load());
        $this->dir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'td-reales-import-'.uniqid();
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
     * Creates the dealers and the workbooks of a 60-vehicle run.
     *
     * @return array<string, int> linked vehicles per dealer slug
     */
    private function prepare(): array
    {
        app(RealDemoDealers::class)->create();
        $this->artisan('demo:reales-xlsx', ['--cantidad' => 60, '--dir' => $this->dir])->assertExitCode(0);

        $perDealer = [];
        foreach ((new RealDemoInventory)->vehicles(60) as $vehicle) {
            if ($vehicle['linked']) {
                $perDealer[$vehicle['dealer']] = ($perDealer[$vehicle['dealer']] ?? 0) + 1;
            }
        }

        return $perDealer;
    }

    private function vehiclesOf(string $slug): int
    {
        return DB::table('vehiculo_concesionaria')
            ->join('concesionaria', 'concesionaria.id', '=', 'vehiculo_concesionaria.concesionaria_id')
            ->join('users', 'users.id', '=', 'concesionaria.usuario_id')
            ->where('users.email', RealDemoDealers::email($slug))
            ->count();
    }

    public function test_a_dry_run_writes_nothing_and_reports_the_counts_per_dealer(): void
    {
        $perDealer = $this->prepare();

        $this->artisan('demo:reales-importar', ['--dir' => $this->dir])
            ->expectsOutputToContain('sqlite')
            ->expectsOutputToContain(array_key_first($perDealer))
            ->expectsOutputToContain('would import')
            ->expectsOutputToContain('Dry run: nothing was written. Add --confirm')
            ->assertExitCode(0);

        $this->assertSame(0, Vehiculo::query()->count());
    }

    public function test_confirm_imports_every_file_linked_to_the_catalog_with_seven_photos(): void
    {
        $perDealer = $this->prepare();

        $this->artisan('demo:reales-importar', ['--dir' => $this->dir, '--confirm' => true])
            ->expectsOutputToContain('imported')
            ->assertExitCode(0);

        $this->assertSame(array_sum($perDealer), Vehiculo::query()->count());
        foreach ($perDealer as $slug => $count) {
            $this->assertSame($count, $this->vehiclesOf($slug), $slug);
        }
        $this->assertSame(0, Vehiculo::query()->whereNull('acara_version_id')->count());
        $this->assertSame(0, Vehiculo::query()->withCount('fotos')->get()->where('fotos_count', '!=', 7)->count());
    }

    public function test_a_second_confirm_run_updates_by_plate_and_creates_nothing_new(): void
    {
        $perDealer = $this->prepare();
        $this->artisan('demo:reales-importar', ['--dir' => $this->dir, '--confirm' => true])->assertExitCode(0);

        $this->artisan('demo:reales-importar', ['--dir' => $this->dir, '--confirm' => true])->assertExitCode(0);

        $this->assertSame(array_sum($perDealer), Vehiculo::query()->count());
    }

    public function test_a_missing_dealer_and_a_missing_file_are_reported_and_skipped(): void
    {
        $perDealer = $this->prepare();
        [$noDealer, $noFile] = array_slice(array_keys($perDealer), 0, 2);
        $id = DB::table('users')->where('email', RealDemoDealers::email($noDealer))->value('id');
        $dealerId = DB::table('concesionaria')->where('usuario_id', $id)->value('id');
        DB::table('suscripcion')->where('concesionaria_id', $dealerId)->delete();
        DB::table('concesionaria')->where('id', $dealerId)->delete();
        DB::table('users')->where('id', $id)->delete();
        unlink($this->dir.DIRECTORY_SEPARATOR.$noFile.'.xlsx');

        $this->artisan('demo:reales-importar', ['--dir' => $this->dir, '--confirm' => true])
            ->expectsOutputToContain('dealer not found, run demo:reales-concesionarias')
            ->expectsOutputToContain('file not found')
            ->assertExitCode(0);

        $this->assertSame(0, $this->vehiclesOf($noFile));
        $this->assertSame(array_sum($perDealer) - $perDealer[$noDealer] - $perDealer[$noFile], Vehiculo::query()->count());
    }

    public function test_a_file_with_row_errors_is_not_applied_and_shows_its_first_errors(): void
    {
        $perDealer = $this->prepare();
        [$owner, $thief] = array_slice(array_keys($perDealer), 0, 2);
        $this->artisan('demo:reales-importar', ['--dir' => $this->dir, '--confirm' => true])->assertExitCode(0);
        // The thief's file now carries the owner's plates, which belong to another dealer.
        copy($this->dir.DIRECTORY_SEPARATOR.$owner.'.xlsx', $this->dir.DIRECTORY_SEPARATOR.$thief.'.xlsx');

        $this->artisan('demo:reales-importar', ['--dir' => $this->dir, '--confirm' => true])
            ->expectsOutputToContain('skipped: errors')
            ->expectsOutputToContain('fila')
            ->assertExitCode(0);

        $this->assertSame($perDealer[$thief], $this->vehiclesOf($thief));
        $this->assertSame($perDealer[$owner], $this->vehiclesOf($owner));
    }

    public function test_it_refuses_to_run_in_production(): void
    {
        $this->prepare();
        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('demo:reales-importar', ['--dir' => $this->dir, '--confirm' => true])
            ->expectsOutputToContain('disabled in production')
            ->assertExitCode(1);

        $this->assertSame(0, Vehiculo::query()->count());
    }

    /**
     * The URL (DB_URL) wins over the `host` key, and Laravel merges it only when it builds the connection.
     */
    #[DataProvider('commands')]
    public function test_the_target_line_shows_the_host_of_the_effective_connection_never_the_password(string $command, array $options): void
    {
        $default = config('database.default');
        config([
            'database.connections.pgsql.host' => 'config-host.invalid',
            'database.connections.pgsql.url' => 'postgresql://user:s3cretpw@url-host.invalid:5432/postgres',
            'database.default' => 'pgsql',
        ]);
        DB::purge('pgsql');

        $output = new BufferedOutput;
        try {
            Artisan::call($command, $options, $output);
        } catch (\Throwable) {
            // It cannot reach the fake host: the target line is printed before any query.
        } finally {
            config(['database.default' => $default]);
            DB::purge('pgsql');
        }

        $text = $output->fetch();
        $this->assertStringContainsString('url-host.invalid', $text);
        $this->assertStringNotContainsString('config-host.invalid', $text);
        $this->assertStringNotContainsString('s3cretpw', $text);
    }

    /**
     * @return array<string, array{string, array<string, string>}>
     */
    public static function commands(): array
    {
        return ['importar' => ['demo:reales-importar', ['--dir' => sys_get_temp_dir()]], 'concesionarias' => ['demo:reales-concesionarias', []]];
    }
}
