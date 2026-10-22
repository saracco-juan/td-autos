<?php

namespace Database\Seeders;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Support\Patente;
use App\Support\VehiculoOptions;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Loads a local database with many vehicles of many active dealers, for manual testing at volume
 * (`php artisan db:local --vehiculos=10000`). Deterministic: the same amount always gives the same
 * data. Inserts in bulk, so it skips model events and is meant for an empty local database only.
 */
class VolumeInventorySeeder extends Seeder
{
    public const DEALERS = 50;

    public const EMAIL_DOMAIN = 'volumen.tdautos.test';

    private const SEED = 20261016;

    private const CHUNK = 500;

    private const FIRST_YEAR = 2008;

    private const LAST_YEAR = 2025;

    /** Reference year of the catalog prices and of "today" for the mileage. */
    private const PRICE_YEAR = 2022;

    private const CURRENT_YEAR = 2026;

    /** Share of the vehicles each dealer gets, by tier: a few big dealers, many small ones. */
    private const TIERS = [[3, 4.0], [8, 2.0], [14, 1.0], [25, 0.4]];

    private int $vehicles = 0;

    /** @var array{dealers: int, vehicles: int, photos: int, seconds: float} */
    private array $stats = ['dealers' => 0, 'vehicles' => 0, 'photos' => 0, 'seconds' => 0.0];

    /** @var array<string, true> */
    private array $plates = [];

    public function withVehicles(int $vehicles): static
    {
        $this->vehicles = $vehicles;

        return $this;
    }

    /**
     * @return array{dealers: int, vehicles: int, photos: int, seconds: float}
     */
    public function stats(): array
    {
        return $this->stats;
    }

    public function run(): void
    {
        $started = hrtime(true);
        mt_srand(self::SEED);

        try {
            $photos = VolumePhotos::ensure();
            $dealers = $this->createDealers();
            $this->loadPlates();
            $this->createVehicles($dealers, $photos);
        } finally {
            mt_srand();
        }

        $this->stats['dealers'] = count($dealers);
        $this->stats['vehicles'] = $this->vehicles;
        $this->stats['photos'] = $this->vehicles * VehiculoOptions::FOTOS_MINIMO;
        $this->stats['seconds'] = round((hrtime(true) - $started) / 1e9, 1);

        $this->command?->info(sprintf(
            'Volume seed: %d dealers, %d vehicles, %d photos in %.1f s.',
            $this->stats['dealers'], $this->stats['vehicles'], $this->stats['photos'], $this->stats['seconds'],
        ));
    }

    /**
     * Active dealers with a current subscription, so the inventory endpoints let them in.
     *
     * @return list<array{id: int, town: string}>
     */
    private function createDealers(): array
    {
        // One hash for every account: hashing 50 times would only slow the seed down.
        $password = Hash::make(DemoDealersSeeder::DEMO_PASSWORD);
        $now = now();
        $dealers = [];

        DB::transaction(function () use (&$dealers, $password, $now) {
            foreach (array_slice(VolumeCatalog::DEALERS, 0, self::DEALERS) as $index => [$name, $town, $province]) {
                $userId = DB::table('users')->insertGetId([
                    'name' => 'Responsable',
                    'apellido' => $name,
                    'email' => sprintf('concesionaria%02d@%s', $index + 1, self::EMAIL_DOMAIN),
                    'email_verified_at' => $now,
                    'password' => $password,
                    'rol' => User::ROL_CONCESIONARIA,
                    'activo' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $dealerId = DB::table('concesionaria')->insertGetId([
                    'usuario_id' => $userId,
                    'nombre' => $name,
                    'responsable_dni' => (string) mt_rand(20000000, 45000000),
                    'telefono_publico' => sprintf('%d 4%03d-%04d', mt_rand(221, 388), mt_rand(0, 999), mt_rand(0, 9999)),
                    'telefono_responsable' => sprintf('%d 15%02d-%06d', mt_rand(221, 388), mt_rand(10, 99), mt_rand(0, 999999)),
                    'direccion' => VolumeCatalog::STREETS[mt_rand(0, count(VolumeCatalog::STREETS) - 1)].' '.mt_rand(100, 4900),
                    'localidad' => $town,
                    'provincia' => $province,
                    'estado_alta' => Concesionaria::ESTADO_ACTIVA,
                    'creada_en' => $now,
                ]);

                DB::table('suscripcion')->insert([
                    'concesionaria_id' => $dealerId,
                    'estado' => Suscripcion::ESTADO_ACTIVA,
                    'vigente_desde' => $now->toDateString(),
                    'vigente_hasta' => $now->copy()->addYear()->toDateString(),
                ]);

                $dealers[] = ['id' => $dealerId, 'town' => $town];
            }
        });

        return $dealers;
    }

    /**
     * Plates already in the database count as taken, whatever their case.
     */
    private function loadPlates(): void
    {
        foreach (DB::table('vehiculo_concesionaria')->whereNotNull('patente_normalizada')->pluck('patente_normalizada') as $plate) {
            $this->plates[Patente::normalize($plate)] = true;
        }
    }

    /**
     * @param  list<array{id: int, town: string}>  $dealers
     * @param  array<int, string>  $photos
     */
    private function createVehicles(array $dealers, array $photos): void
    {
        $bodyTypes = DB::table('tipo_carroceria')->pluck('id', 'nombre')->all();
        $nextId = (int) DB::table('vehiculo')->max('id') + 1;
        $buffer = ['vehiculo' => [], 'vehiculo_concesionaria' => [], 'foto_vehiculo' => []];

        foreach ($this->allocate(count($dealers)) as $index => $count) {
            for ($i = 0; $i < $count; $i++) {
                [$vehicle, $plate] = $this->vehicleRow($dealers[$index]['town'], $bodyTypes);
                $vehicle['id'] = $nextId;

                $buffer['vehiculo'][] = $vehicle;
                $buffer['vehiculo_concesionaria'][] = [
                    'vehiculo_id' => $nextId,
                    'concesionaria_id' => $dealers[$index]['id'],
                    'patente_normalizada' => $plate,
                    'visible' => true,
                ];
                foreach ($photos as $order => $location) {
                    $buffer['foto_vehiculo'][] = ['vehiculo_id' => $nextId, 'ubicacion_archivo' => $location, 'orden' => $order];
                }

                $nextId++;

                if (count($buffer['vehiculo']) >= self::CHUNK) {
                    $this->flush($buffer);
                }
            }
        }

        $this->flush($buffer);
    }

    /**
     * @param  array<string, list<array<string, mixed>>>  $buffer
     */
    private function flush(array &$buffer): void
    {
        if ($buffer['vehiculo'] === []) {
            return;
        }

        DB::transaction(function () use ($buffer) {
            foreach ($buffer as $table => $rows) {
                // Rows per statement stay under SQLite's limit on bound variables.
                foreach (array_chunk($rows, $table === 'foto_vehiculo' ? 2000 : self::CHUNK) as $chunk) {
                    DB::table($table)->insert($chunk);
                }
            }
        });

        $buffer = array_map(fn () => [], $buffer);
    }

    /**
     * How many vehicles each dealer gets: tiers of big and small dealers with some jitter, adding up
     * to exactly the requested amount.
     *
     * @return list<int>
     */
    private function allocate(int $dealers): array
    {
        $weights = [];
        foreach (self::TIERS as [$size, $weight]) {
            for ($i = 0; $i < $size; $i++) {
                $weights[] = $weight * mt_rand(70, 130) / 100;
            }
        }
        $weights = array_slice($weights, 0, $dealers);

        if ($this->vehicles < $dealers) {
            return array_map(fn (int $i) => (int) ($i < $this->vehicles), array_keys($weights));
        }

        $total = array_sum($weights);
        $counts = array_map(fn (float $weight) => max(1, (int) round($this->vehicles * $weight / $total)), $weights);

        // Rounding drift goes to the biggest dealer, which is the first one.
        $counts[0] += $this->vehicles - array_sum($counts);

        return $counts;
    }

    /**
     * @param  array<string, int>  $bodyTypes
     * @return array{array<string, mixed>, string}
     */
    private function vehicleRow(string $town, array $bodyTypes): array
    {
        [$brand, $model, $version, $body, $basePrice, $fuel, $transmission, $firstYear] =
            VolumeCatalog::MODELS[mt_rand(0, count(VolumeCatalog::MODELS) - 1)];

        $year = $this->year($firstYear);
        $km = $this->mileage($year);

        // Old petrol hatchbacks and sedans are often converted to natural gas.
        if ($fuel === 'nafta' && $year <= 2017 && mt_rand(1, 100) <= 12) {
            $fuel = 'gnc';
        }

        $transmission = match ($transmission) {
            'm' => 'manual',
            'a' => 'automatica',
            default => mt_rand(1, 100) <= 35 ? 'automatica' : 'manual',
        };

        return [[
            'origen' => VehiculoOptions::ORIGEN_CONCESIONARIA,
            'tipo_carroceria_id' => $bodyTypes[$body],
            'marca' => $brand,
            'modelo' => $model,
            'version' => $version,
            'anio' => $year,
            'kilometraje' => $km,
            'precio' => $this->price($basePrice, $year, $km),
            'moneda' => VehiculoOptions::MONEDA,
            'combustible' => $fuel,
            'transmision' => $transmission,
            'ubicacion' => $town,
            'descripcion' => "{$brand} {$model} {$version} {$year}. ".VolumeCatalog::DESCRIPTIONS[mt_rand(0, count(VolumeCatalog::DESCRIPTIONS) - 1)],
        ], $this->plate($year)];
    }

    /**
     * Mostly recent cars: the mean of three draws leans to the middle of the range.
     */
    private function year(int $firstYear): int
    {
        $first = max($firstYear, self::FIRST_YEAR);
        $year = (int) round((mt_rand($first, self::LAST_YEAR) + mt_rand($first, self::LAST_YEAR) + mt_rand($first, self::LAST_YEAR)) / 3);

        return min(max($year, $first), self::LAST_YEAR);
    }

    /**
     * About 8,000 to 20,000 km per year of age.
     */
    private function mileage(int $year): int
    {
        $age = max(0.3, self::CURRENT_YEAR - $year - mt_rand(0, 100) / 100);

        return (int) (round($age * mt_rand(8000, 20000) / 100) * 100);
    }

    /**
     * The reference price, depreciated 7% a year, adjusted by mileage against the expected one and a
     * little noise, rounded to 50,000 pesos.
     */
    private function price(float $basePrice, int $year, int $km): float
    {
        $expected = (self::CURRENT_YEAR - $year) * 13000;
        $mileage = min(1.12, max(0.85, 1 - ($km - $expected) / 500000));
        $price = $basePrice * 1000000 * 0.93 ** (self::PRICE_YEAR - $year) * $mileage * mt_rand(930, 1070) / 1000;

        return round($price / 50000) * 50000;
    }

    /**
     * A normalized plate nobody has: the old AAA123 format until 2016, mostly Mercosur AA123AA after.
     */
    private function plate(int $year): string
    {
        $mercosurShare = match (true) {
            $year <= 2015 => 0,
            $year === 2016 => 50,
            default => 90,
        };

        do {
            $plate = mt_rand(1, 100) <= $mercosurShare
                ? $this->letters(2).sprintf('%03d', mt_rand(0, 999)).$this->letters(2)
                : $this->letters(3).sprintf('%03d', mt_rand(0, 999));
        } while (isset($this->plates[$plate]));

        $this->plates[$plate] = true;

        return $plate;
    }

    private function letters(int $count): string
    {
        $letters = '';
        for ($i = 0; $i < $count; $i++) {
            $letters .= chr(mt_rand(65, 90));
        }

        return $letters;
    }
}
