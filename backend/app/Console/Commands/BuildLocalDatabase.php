<?php

namespace App\Console\Commands;

use Database\Seeders\DemoDealersSeeder;
use Database\Seeders\LocalDevSeeder;
use Database\Seeders\VolumeInventorySeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Rebuilds a local SQLite file with every migration and the demo seed. It always targets its own
 * connection, never the one in .env, so it cannot wipe a remote database.
 */
class BuildLocalDatabase extends Command
{
    private const CONNECTION = 'local_dev';

    protected $signature = 'db:local {--path= : SQLite file (default: database/manual.sqlite)}
        {--vehiculos= : Extra dealer vehicles to load on top of the demo seed (default: none)}';

    protected $description = 'Rebuild a local SQLite database with demo data';

    public function handle(): int
    {
        if (app()->environment('production')) {
            $this->error('db:local is disabled in production.');

            return self::FAILURE;
        }

        $vehicles = $this->vehiclesOption();

        if ($vehicles === null) {
            $this->error('--vehiculos must be a whole number, 0 or more.');

            return self::FAILURE;
        }

        $path = (string) ($this->option('path') ?: database_path('manual.sqlite'));

        if (is_file($path)) {
            unlink($path);
        }
        touch($path);
        $path = realpath($path);

        config(['database.connections.'.self::CONNECTION => [
            'driver' => 'sqlite',
            'database' => $path,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]]);

        $previous = [
            'database.default' => config('database.default'),
            'filesystems.vehicle_photos_disk' => config('filesystems.vehicle_photos_disk'),
            'filesystems.receipts_disk' => config('filesystems.receipts_disk'),
        ];

        try {
            // Models and seeders use the default connection, so point it at the local file meanwhile.
            config(['database.default' => self::CONNECTION]);
            // Local fixtures must never upload demo assets to a configured remote disk.
            config(['filesystems.vehicle_photos_disk' => 'public', 'filesystems.receipts_disk' => 'local']);
            DB::purge(self::CONNECTION);

            $this->call('migrate:fresh', [
                '--database' => self::CONNECTION,
                '--seed' => true,
                '--seeder' => LocalDevSeeder::class,
                '--force' => true,
            ]);

            if ($vehicles > 0) {
                app(VolumeInventorySeeder::class)->withVehicles($vehicles)->setCommand($this)->run();
            }
        } finally {
            config($previous);
            DB::purge(self::CONNECTION);
        }

        $password = DemoDealersSeeder::DEMO_PASSWORD;

        $this->newLine();
        $this->info("Local database ready: {$path}");
        $this->line('Add to backend/.env to use it:');
        $this->line('  DB_CONNECTION=sqlite');
        $this->line("  DB_DATABASE={$path}");
        $this->line('Demo accounts (password: '.$password.'):');
        $this->line('  '.LocalDevSeeder::ADMIN_EMAIL.' (admin)');
        $this->line('  '.LocalDevSeeder::BUYER_EMAIL.' (buyer)');
        $this->line('  *@demo.tdautos.test (dealers: sur, rosario, cuyo, norte, capital, pampa, litoral)');

        if ($vehicles > 0) {
            $this->line('  concesionariaNN@'.VolumeInventorySeeder::EMAIL_DOMAIN.' (active dealers with the volume inventory, NN = 01 to '.VolumeInventorySeeder::DEALERS.')');
            $this->line('Vehicle photos are files on the public disk: run `php artisan storage:link` once so they load.');
        }

        return self::SUCCESS;
    }

    /**
     * The amount asked for, 0 when the option is absent, or null when it is not a whole number >= 0.
     */
    private function vehiclesOption(): ?int
    {
        $value = $this->option('vehiculos');

        if ($value === null) {
            return 0;
        }

        $amount = filter_var($value, FILTER_VALIDATE_INT);

        return $amount === false || $amount < 0 ? null : $amount;
    }
}
