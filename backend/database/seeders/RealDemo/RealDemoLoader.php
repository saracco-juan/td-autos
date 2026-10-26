<?php

namespace Database\Seeders\RealDemo;

use App\Support\VehiculoFields;
use App\Support\VehiculoOptions;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Loads the real demo inventory (UH-05) into a local database: the ten dealers and their vehicles,
 * with the ACARA link kept only on the linked ones. Bulk inserts that skip model events, so it is
 * meant for an empty local database (`php artisan db:local --reales=800`); never run it remotely.
 */
final class RealDemoLoader
{
    public const EMAIL_DOMAIN = RealDemoDealers::EMAIL_DOMAIN;

    private const CHUNK = 500;

    /** Columns copied as they are from a generated vehicle. */
    private const COPIED = [
        'marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio', 'moneda', 'transmision', 'combustible',
        'ubicacion', 'descripcion', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad',
        'consumo_urbano', 'consumo_ruta',
    ];

    public function __construct(private readonly RealDemoInventory $inventory, private readonly RealDemoDealers $dealers) {}

    /**
     * @return array{dealers: int, vehicles: int, unlinked: int}
     */
    public function load(int $count, ?Command $command = null): array
    {
        $vehicles = $this->inventory->vehicles($count);
        $this->assertPlatesAreFree($vehicles);

        $dealers = array_map(fn (array $dealer) => $dealer['id'], $this->dealers->create());
        $this->createVehicles($vehicles, $dealers);

        $unlinked = count(array_filter($vehicles, fn (array $vehicle) => ! $vehicle['linked']));
        $command?->info(sprintf('Real demo: %d dealers, %d vehicles (%d not linked to ACARA).', count($dealers), count($vehicles), $unlinked));

        return ['dealers' => count($dealers), 'vehicles' => count($vehicles), 'unlinked' => $unlinked];
    }

    /**
     * @param  list<array<string, mixed>>  $vehicles
     */
    private function assertPlatesAreFree(array $vehicles): void
    {
        $taken = DB::table('vehiculo_concesionaria')
            ->whereIn('patente_normalizada', array_column($vehicles, 'patente'))
            ->pluck('patente_normalizada');

        if ($taken->isNotEmpty()) {
            throw new RuntimeException('Plate already loaded in the local database: '.$taken->first().'. Start from an empty database.');
        }
    }

    /**
     * @param  list<array<string, mixed>>  $vehicles
     * @param  array<string, int>  $dealers
     */
    private function createVehicles(array $vehicles, array $dealers): void
    {
        $bodies = DB::table('tipo_carroceria')->pluck('id', 'nombre')->all();
        $nextId = (int) DB::table('vehiculo')->max('id') + 1;

        foreach (array_chunk($vehicles, self::CHUNK) as $chunk) {
            $buffer = ['vehiculo' => [], 'vehiculo_concesionaria' => [], 'foto_vehiculo' => []];

            foreach ($chunk as $vehicle) {
                $buffer['vehiculo'][] = [
                    'id' => $nextId,
                    'origen' => VehiculoOptions::ORIGEN_CONCESIONARIA,
                    'tipo_carroceria_id' => $bodies[$vehicle['carroceria']],
                    'acara_version_id' => $vehicle['linked'] ? $vehicle['acara_version_id'] : null,
                    ...array_intersect_key($vehicle, array_flip([...self::COPIED, ...array_keys(VehiculoFields::EQUIPMENT_FIELDS)])),
                ];
                $buffer['vehiculo_concesionaria'][] = [
                    'vehiculo_id' => $nextId,
                    'concesionaria_id' => $dealers[$vehicle['dealer']],
                    'patente_normalizada' => $vehicle['patente'],
                    'visible' => true,
                ];
                foreach ($vehicle['fotos'] as $order => $url) {
                    $buffer['foto_vehiculo'][] = ['vehiculo_id' => $nextId, 'ubicacion_archivo' => $url, 'orden' => $order + 1];
                }

                $nextId++;
            }

            DB::transaction(function () use ($buffer) {
                foreach ($buffer as $table => $rows) {
                    // Rows per statement stay under SQLite's limit on bound variables.
                    foreach (array_chunk($rows, $table === 'foto_vehiculo' ? 2000 : 200) as $part) {
                        DB::table($table)->insert($part);
                    }
                }
            });
        }
    }
}
