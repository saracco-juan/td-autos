<?php

namespace Database\Factories;

use App\Models\Vehiculo;
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
            ['Toyota', 'Corolla', 'XEI 2.0 CVT'],
            ['Volkswagen', 'Gol Trend', 'Trendline 1.6'],
            ['Ford', 'Focus', 'SE 1.6'],
            ['Chevrolet', 'Onix', 'LTZ 1.4'],
            ['Renault', 'Sandero', 'Stepway 1.6'],
            ['Fiat', 'Cronos', 'Drive 1.3'],
        ]);

        return [
            'origen' => 'concesionaria',
            'tipo_carroceria_id' => null,
            'marca' => $car[0],
            'modelo' => $car[1],
            'version' => $car[2],
            'anio' => fake()->numberBetween(2012, 2023),
            'kilometraje' => fake()->numberBetween(10000, 180000),
            'precio' => fake()->numberBetween(8, 35) * 1000000,
            'moneda' => 'ARS',
            'combustible' => fake()->randomElement(['Nafta', 'Diésel', 'GNC']),
            'transmision' => fake()->randomElement(['Manual', 'Automática']),
            'ubicacion' => fake()->randomElement(['Córdoba', 'Rosario', 'Mendoza', 'CABA']),
        ];
    }
}
