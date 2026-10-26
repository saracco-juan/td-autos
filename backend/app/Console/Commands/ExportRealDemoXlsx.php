<?php

namespace App\Console\Commands;

use App\Services\Inventario\VehiculoImportColumns;
use avadim\FastExcelWriter\Excel;
use Database\Seeders\RealDemo\RealDemoInventory;
use Database\Seeders\RealDemo\RealDemoLoader;
use Illuminate\Console\Command;

/**
 * Writes the real demo inventory (UH-05) as one importable XLSX per dealer, to load a deployed
 * environment through the app's own import. Same seed and vehicles as `db:local --reales`, minus the
 * ones not linked to ACARA: the import links by exact catalog match, so it cannot create those.
 */
class ExportRealDemoXlsx extends Command
{
    protected $signature = 'demo:reales-xlsx {--cantidad=800 : Vehicles to generate before dropping the unlinked ones}
        {--dir= : Output folder (default: storage/app/demo-reales)}';

    protected $description = 'Write one importable XLSX per demo dealer with the real demo inventory';

    public function handle(): int
    {
        $amount = filter_var($this->option('cantidad'), FILTER_VALIDATE_INT);

        if ($amount === false || $amount < 1) {
            $this->error('--cantidad must be a whole number, 1 or more.');

            return self::FAILURE;
        }

        $perDealer = [];
        foreach ((new RealDemoInventory)->vehicles($amount) as $vehicle) {
            if ($vehicle['linked']) {
                $perDealer[$vehicle['dealer']][] = $vehicle;
            }
        }

        foreach ($perDealer as $slug => $vehicles) {
            if (count($vehicles) > VehiculoImportColumns::MAX_ROWS) {
                $this->error("{$slug} would get ".count($vehicles).' rows, over the '.VehiculoImportColumns::MAX_ROWS.'-row limit of one import file. Use a smaller --cantidad.');

                return self::FAILURE;
            }
        }

        $dir = (string) ($this->option('dir') ?: storage_path('app/demo-reales'));
        if (! is_dir($dir) && ! mkdir($dir, 0777, true) && ! is_dir($dir)) {
            $this->error("Cannot create {$dir}.");

            return self::FAILURE;
        }

        $summary = fopen($dir.DIRECTORY_SEPARATOR.'dealers.csv', 'w');
        fputcsv($summary, ['slug', 'nombre', 'email', 'localidad', 'provincia', 'vehículos']);

        foreach (RealDemoInventory::DEALERS as $dealer) {
            $vehicles = $perDealer[$dealer['slug']] ?? [];
            if ($vehicles === []) {
                continue;
            }
            $this->writeWorkbook($dir.DIRECTORY_SEPARATOR.$dealer['slug'].'.xlsx', $vehicles);
            fputcsv($summary, [
                $dealer['slug'], $dealer['nombre'], $dealer['slug'].'@'.RealDemoLoader::EMAIL_DOMAIN,
                $dealer['localidad'], $dealer['provincia'], count($vehicles),
            ]);
        }
        fclose($summary);

        $this->info('Wrote '.count($perDealer)." workbooks and dealers.csv to {$dir}.");

        return self::SUCCESS;
    }

    /**
     * @param  list<array<string, mixed>>  $vehicles
     */
    private function writeWorkbook(string $path, array $vehicles): void
    {
        $headers = VehiculoImportColumns::headers();
        $excel = Excel::create(['Inventario'], ['temp_dir' => sys_get_temp_dir()]);
        $sheet = $excel->sheet();
        $sheet->setColFormats(array_fill(0, count($headers), '@'));
        $sheet->writeRow($headers);

        foreach ($vehicles as $vehicle) {
            $sheet->writeRow(array_map(fn (string $header) => $this->cell($header, $vehicle), $headers));
        }

        $excel->save($path);
    }

    /**
     * Every cell is text: booleans as "sí"/"no", photos joined with "|", the body type by name.
     *
     * @param  array<string, mixed>  $vehicle
     */
    private function cell(string $header, array $vehicle): string
    {
        $value = match (true) {
            $header === 'fotos' => implode('|', $vehicle['fotos']),
            $header === 'carroceria' => $vehicle['carroceria'],
            default => $vehicle[$header],
        };

        return match (true) {
            is_bool($value) => $value ? 'sí' : 'no',
            $value === null => '',
            default => (string) $value,
        };
    }
}
