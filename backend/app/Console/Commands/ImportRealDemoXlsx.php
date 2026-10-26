<?php

namespace App\Console\Commands;

use App\Models\Concesionaria;
use App\Models\User;
use App\Services\Inventario\ImportConflictException;
use App\Services\Inventario\ImportPlan;
use App\Services\Inventario\VehiculoImportApplier;
use App\Services\Inventario\VehiculoImportPlanner;
use App\Support\VehiculoFields;
use Database\Seeders\RealDemo\RealDemoDealers;
use Database\Seeders\RealDemo\RealDemoInventory;
use Database\Seeders\RealDemo\RealDemoTarget;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

/**
 * Loads the XLSX files of `demo:reales-xlsx` into the current database (UH-05) through the same planner
 * and applier as the dealer's "Importar XLSX" endpoint, one demo dealer at a time. Dry run unless --confirm.
 */
class ImportRealDemoXlsx extends Command
{
    private const SHOWN_ERRORS = 3;

    protected $signature = 'demo:reales-importar {--dir= : Folder with the <slug>.xlsx files (default: storage/app/demo-reales)}
        {--confirm : Write to the database (without it, only preview what would be imported)}';

    protected $description = 'Import the real demo XLSX files as each demo dealer (dry run without --confirm)';

    public function handle(VehiculoImportPlanner $planner, VehiculoImportApplier $applier): int
    {
        if (app()->environment('production')) {
            $this->error('demo:reales-importar is disabled in production.');

            return self::FAILURE;
        }

        $this->line('Target database: '.RealDemoTarget::describe());

        $dir = (string) ($this->option('dir') ?: storage_path('app/demo-reales'));
        $confirmed = (bool) $this->option('confirm');
        $rows = [];

        foreach (RealDemoInventory::DEALERS as $demo) {
            $rows[] = $this->importFile($planner, $applier, $demo, $dir, $confirmed);
        }

        $this->table(['slug', 'dealer', 'new', 'updated', 'errors', 'status'], $rows);

        if (! $confirmed) {
            $this->warn('Dry run: nothing was written. Add --confirm to import.');
        }

        return self::SUCCESS;
    }

    /**
     * @param  array{slug: string, nombre: string}  $demo
     * @return list<string|int>
     */
    private function importFile(VehiculoImportPlanner $planner, VehiculoImportApplier $applier, array $demo, string $dir, bool $confirmed): array
    {
        $slug = $demo['slug'];
        $skipped = fn (string $reason, int $errors = 0) => [$slug, $demo['nombre'], '-', '-', $errors, 'skipped: '.$reason];

        $path = $dir.DIRECTORY_SEPARATOR.$slug.'.xlsx';
        if (! is_file($path)) {
            return $skipped('file not found');
        }

        $user = User::query()->where('email', RealDemoDealers::email($slug))->first();
        $dealer = $user ? Concesionaria::query()->where('usuario_id', $user->id)->first() : null;
        if ($dealer === null) {
            return $skipped('dealer not found, run demo:reales-concesionarias');
        }

        try {
            $plan = $planner->plan($dealer, (string) file_get_contents($path));
        } catch (ValidationException $e) {
            return $skipped('unreadable file: '.implode(' ', $e->validator->errors()->all()));
        }

        if ($plan->hasErrors()) {
            $this->reportErrors($slug, $plan->errores());

            return [$slug, $demo['nombre'], '-', '-', count($plan->errores()), 'skipped: errors'];
        }

        if ($confirmed) {
            try {
                $applier->apply($dealer, $plan);
            } catch (ImportConflictException $e) {
                $this->reportErrors($slug, [['fila' => $e->row->fila, 'patente' => $e->row->patente, 'mensajes' => [VehiculoFields::PATENTE_TAKEN_MESSAGE]]]);

                return $skipped('errors', 1);
            }
        }

        return [$slug, $demo['nombre'], ...$this->counts($plan), 0, $confirmed ? 'imported' : 'would import'];
    }

    /**
     * @return array{int, int} new and updated rows
     */
    private function counts(ImportPlan $plan): array
    {
        return [count($plan->nuevos()), count($plan->actualizaciones())];
    }

    /**
     * @param  list<array{fila: int, patente: ?string, mensajes: list<string>}>  $errors
     */
    private function reportErrors(string $slug, array $errors): void
    {
        $this->error("{$slug}: ".count($errors).' rows with errors, nothing applied.');
        foreach (array_slice($errors, 0, self::SHOWN_ERRORS) as $error) {
            $this->line(sprintf('  fila %d, patente %s: %s', $error['fila'], $error['patente'] ?? '-', implode(' ', $error['mensajes'])));
        }
    }
}
