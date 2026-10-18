<?php

namespace Database\Factories;

use App\Models\TipoCarroceria;
use App\Models\Vehiculo;
use App\Support\VehiculoOptions;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vehiculo>
 */
class VehiculoFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $car = fake()->randomElement([
            ['Toyota', 'Corolla', 'XEI 2.0 CVT', 'Sedán'],
            ['Volkswagen', 'Gol Trend', 'Trendline 1.6', 'Hatchback'],
            ['Ford', 'Focus', 'SE 1.6', 'Hatchback'],
            ['Chevrolet', 'Onix', 'LTZ 1.4', 'Hatchback'],
            ['Renault', 'Sandero', 'Stepway 1.6', 'Hatchback'],
            ['Fiat', 'Cronos', 'Drive 1.3', 'Sedán'],
        ]);

        return [
            'origen' => 'concesionaria',
            // Lazy, so a test that sets its own body type skips the lookup.
            'tipo_carroceria_id' => fn () => TipoCarroceria::where('nombre', $car[3])->value('id'),
            'marca' => $car[0],
            'modelo' => $car[1],
            'version' => $car[2],
            'anio' => fake()->numberBetween(2012, 2023),
            'kilometraje' => fake()->numberBetween(10000, 180000),
            'precio' => fake()->numberBetween(8, 35) * 1000000,
            'moneda' => VehiculoOptions::MONEDA,
            'combustible' => fake()->randomElement(VehiculoOptions::COMBUSTIBLE),
            'transmision' => fake()->randomElement(VehiculoOptions::TRANSMISION),
            'ubicacion' => fake()->randomElement(['Córdoba', 'Rosario', 'Mendoza', 'CABA']),
        ];
    }
}
