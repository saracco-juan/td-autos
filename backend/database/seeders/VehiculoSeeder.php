<?php

namespace Database\Seeders;

use App\Models\Vehiculo;
use Illuminate\Database\Seeder;

/**
 * Fixed used cars (origen = 'seed') so vehicle screens can be tried by hand in development.
 * Safe to run more than once: each car is matched by origen, marca, modelo, version and anio.
 */
class VehiculoSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->vehiculos() as $vehiculo) {
            Vehiculo::updateOrCreate(
                array_intersect_key($vehiculo, array_flip(['origen', 'marca', 'modelo', 'version', 'anio'])),
                $vehiculo,
            );
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function vehiculos(): array
    {
        return [
            $this->vehiculo('Toyota', 'Corolla', 'XEI', 2021, 62000, 28500000, 'Nafta', 'Automática', 'CABA'),
            $this->vehiculo('Volkswagen', 'Gol Trend', 'Trendline 1.6', 2018, 84000, 12900000, 'Nafta', 'Manual', 'Córdoba'),
            $this->vehiculo('Ford', 'Focus', 'SE Plus 2.0', 2017, 98000, 14800000, 'Nafta', 'Automática', 'Rosario'),
            $this->vehiculo('Chevrolet', 'Onix', 'LTZ 1.4', 2019, 71000, 15600000, 'Nafta', 'Manual', 'Mendoza'),
            $this->vehiculo('Renault', 'Sandero', 'Stepway 1.6', 2020, 55000, 16900000, 'Nafta', 'Manual', 'La Plata'),
            $this->vehiculo('Fiat', 'Cronos', 'Drive 1.3', 2022, 38000, 19500000, 'Nafta', 'Manual', 'CABA'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function vehiculo(
        string $marca,
        string $modelo,
        string $version,
        int $anio,
        int $kilometraje,
        int $precio,
        string $combustible,
        string $transmision,
        string $ubicacion,
    ): array {
        return [
            'origen' => 'seed',
            'marca' => $marca,
            'modelo' => $modelo,
            'version' => $version,
            'anio' => $anio,
            'kilometraje' => $kilometraje,
            'precio' => $precio,
            'moneda' => 'ARS',
            'combustible' => $combustible,
            'transmision' => $transmision,
            'ubicacion' => $ubicacion,
        ];
    }
}
