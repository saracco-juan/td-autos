<?php

namespace Database\Seeders;

use App\Models\Vehiculo;
use Database\Seeders\Support\DemoVehicleFacts;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/** Opt-in repair of the ten inspected local demo listings; never an inventory import. */
class ResaleDemoRepairSeeder extends Seeder
{
    // ACARA 2026-10-19, pages 53, 69, 99, 100, 144, 153, 187 and 221.
    // Deliberately retain natural dealer labels rather than copying the catalog's exact strings.
    // make, model, year, km, town, old version, corrected version, engine, CV, turbo.
    public const FIXTURES = [
        ['Citroën', 'C4 Cactus', 2021, 62200, 'San Rafael', 'Feel 1.6', 'Feel Pack 1.6 AT', '1.6', 115, false],
        ['Toyota', 'Corolla', 2019, 61000, 'Santa Rosa', 'XEi', 'XEi 1.8 CVT', '1.8', 140, false],
        ['Toyota', 'Corolla', 2019, 62000, 'Paraná', 'XEi', 'XEi 1.8 CVT', '1.8', 140, false],
        ['Volkswagen', 'Virtus', 2022, 66700, 'Salta', 'Highline 1.6 AT', 'Highline 1.6 AT', '1.6', 110, false],
        ['Honda', 'HR-V', 2022, 55000, 'La Plata', 'EXL 1.8', 'EXL 1.8 CVT', '1.8', 140, false],
        ['Honda', 'Civic', 2019, 101800, 'Santa Fe', 'EXL 2.0', 'EXL 2.0 CVT', '2.0', 154, false],
        ['Honda', 'Civic', 2013, 209500, 'Villa Carlos Paz', 'EXL 2.0', 'EXS 1.8 AT', '1.8', 140, false],
        ['Fiat', 'Pulse', 2024, 21300, 'San Luis', 'Drive 1.3 Turbo', 'Drive 1.3 CVT', '1.3', 99, false],
        ['Peugeot', '408', 2020, 66000, 'San Isidro', 'Allure 2.0', 'Allure Pack 1.6 THP AT', '1.6', 163, true],
        ['NISSAN', 'Versa', 2018, 65000, 'Santa Rosa', '1.6 Advance (107cv) 4Ptas.', 'Advance 1.6 AT', '1.6', 107, false],
    ];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing']) || DB::connection()->getDriverName() !== 'sqlite') {
            throw new RuntimeException('Demo repair requires local SQLite or isolated SQLite tests.');
        }

        DB::transaction(function (): void {
            foreach (self::FIXTURES as [$make, $model, $year, $km, $town, $old, $version, $engine, $power, $turbo]) {
                $cars = Vehiculo::where('marca', $make)->where('modelo', $model)->where('anio', $year)
                    ->where('kilometraje', $km)->where('ubicacion', $town)->get();
                if ($cars->count() > 1) {
                    throw new RuntimeException('Ambiguous synthetic fixture; no repair applied.');
                }
                if ($cars->isEmpty()) {
                    continue;
                }
                $car = $cars->sole();
                $email = DB::table('vehiculo_concesionaria as ownership')
                    ->join('concesionaria as dealer', 'dealer.id', '=', 'ownership.concesionaria_id')
                    ->join('users', 'users.id', '=', 'dealer.usuario_id')
                    ->where('ownership.vehiculo_id', $car->id)->value('users.email');
                $notice = str_contains($car->descripcion ?? '', DemoVehicleFacts::NOTICE)
                    || str_starts_with($car->descripcion ?? '', 'HU05 integration test listing. Synthetic equipment and placeholder images;');
                if (! $notice || ! preg_match('/@(demo|volumen)\.tdautos\.test\z/', $email ?? '')
                    || $car->origen !== 'concesionaria' || $car->transmision !== 'automatica'
                    || $car->combustible !== 'nafta' || ! in_array($car->version, [$old, $version], true)) {
                    throw new RuntimeException('Unrecognized or non-synthetic fixture; no repair applied.');
                }
                $description = $car->descripcion;
                $oldTitle = "$make $model $old $year.";
                if (str_starts_with($description, $oldTitle)) {
                    $description = "$make $model $version $year.".substr($description, strlen($oldTitle));
                }
                $car->fill(['version' => $version, 'motor' => $engine, 'potencia' => $power,
                    'potencia_unidad' => 'CV', 'turbo' => $turbo, 'descripcion' => $description]);
                if ($car->isDirty()) {
                    $car->save();
                }
            }
        });
    }
}
