<?php

namespace App\Console\Commands;

use Database\Seeders\RealDemo\RealDemoDealers;
use Database\Seeders\RealDemo\RealDemoInventory;
use Illuminate\Console\Command;

/**
 * Creates only the ten real demo dealers (UH-05) in the current database, so the XLSX files of
 * `demo:reales-xlsx` can be imported there. Existing dealers are skipped, nothing else is touched.
 */
class CreateRealDemoDealers extends Command
{
    protected $signature = 'demo:reales-concesionarias {--confirm : Write to the database (without it, only list what would be created)}';

    protected $description = 'Create the ten real demo dealers in the current database (dry run without --confirm)';

    public function handle(RealDemoDealers $dealers): int
    {
        if (app()->environment('production')) {
            $this->error('demo:reales-concesionarias is disabled in production.');

            return self::FAILURE;
        }

        $connection = config('database.connections.'.config('database.default'), []);
        $this->line(sprintf(
            'Target database: %s @ %s',
            $connection['driver'] ?? '?',
            $connection['host'] ?? $connection['database'] ?? '?',
        ));

        $confirmed = (bool) $this->option('confirm');
        $created = $confirmed ? $dealers->create(skipExisting: true) : null;

        $rows = [];
        foreach (RealDemoInventory::DEALERS as $dealer) {
            $status = $confirmed
                ? ($created[$dealer['slug']]['created'] ? 'created' : 'skipped')
                : ($dealers->exists($dealer['slug']) ? 'would skip' : 'would create');
            $rows[] = [$dealer['slug'], $dealer['nombre'], RealDemoDealers::email($dealer['slug']), $dealer['provincia'], $status];
        }
        $this->table(['slug', 'nombre', 'email', 'provincia', 'estado'], $rows);

        if (! $confirmed) {
            $this->warn('Dry run: nothing was written. Add --confirm to create the dealers.');
        }
        $this->line('contraseña de demo: la de DemoDealersSeeder');

        return self::SUCCESS;
    }
}
