<?php

namespace Database\Seeders\RealDemo;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Support\VehiculoFields;
use App\Support\VehiculoOptions;
use Database\Seeders\DemoDealersSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

/**
 * Loads the real demo inventory (UH-05) into a local database: the ten dealers and their vehicles,
 * with the ACARA link kept only on the linked ones. Bulk inserts that skip model events, so it is
 * meant for an empty local database (`php artisan db:local --reales=800`); never run it remotely.
 */
final class RealDemoLoader
{
    public const EMAIL_DOMAIN = 'reales.tdautos.test';

    private const CHUNK = 500;

    /** Columns copied as they are from a generated vehicle. */
    private const COPIED = [
        'marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio', 'moneda', 'transmision', 'combustible',
        'ubicacion', 'descripcion', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad',
        'consumo_urbano', 'consumo_ruta',
    ];

    public function __construct(private readonly RealDemoInventory $inventory) {}

    /**
     * @return array{dealers: int, vehicles: int, unlinked: int}
     */
    public function load(int $count, ?Command $command = null): array
    {
        $vehicles = $this->inventory->vehicles($count);
        $this->assertPlatesAreFree($vehicles);

        $dealers = $this->createDealers();
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
     * Active dealers with a current subscription, so the inventory endpoints let them in.
     *
     * @return array<string, int> dealer id by slug
     */
    private function createDealers(): array
    {
        // One hash for every account: hashing ten times would only slow the load down.
        $password = Hash::make(DemoDealersSeeder::DEMO_PASSWORD);
        $now = now();
        $ids = [];

        DB::transaction(function () use (&$ids, $password, $now) {
            foreach (RealDemoInventory::DEALERS as $index => $dealer) {
                $userId = DB::table('users')->insertGetId([
                    'name' => 'Responsable',
                    'apellido' => $dealer['nombre'],
                    'email' => $dealer['slug'].'@'.self::EMAIL_DOMAIN,
                    'email_verified_at' => $now,
                    'password' => $password,
                    'rol' => User::ROL_CONCESIONARIA,
                    'activo' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $ids[$dealer['slug']] = DB::table('concesionaria')->insertGetId([
                    'usuario_id' => $userId,
                    'nombre' => $dealer['nombre'],
                    'responsable_dni' => (string) (30000000 + 111111 * ($index + 1)),
                    'telefono_publico' => $dealer['telefono'],
                    'telefono_responsable' => $dealer['telefono'],
                    'direccion' => $dealer['direccion'],
                    'localidad' => $dealer['localidad'],
                    'provincia' => $dealer['provincia'],
                    'estado_alta' => Concesionaria::ESTADO_ACTIVA,
                    'creada_en' => $now,
                ]);

                DB::table('suscripcion')->insert([
                    'concesionaria_id' => $ids[$dealer['slug']],
                    'estado' => Suscripcion::ESTADO_ACTIVA,
                    'vigente_desde' => $now->toDateString(),
                    'vigente_hasta' => $now->copy()->addYear()->toDateString(),
                ]);
            }
        });

        return $ids;
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
