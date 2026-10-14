<?php

namespace Database\Factories;

use App\Models\Concesionaria;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VehiculoConcesionaria>
 */
class VehiculoConcesionariaFactory extends Factory
{
    /**
     * Define the model's default state: a visible vehicle of an active dealer.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'vehiculo_id' => Vehiculo::factory(),
            'concesionaria_id' => Concesionaria::factory()->active(),
            'patente_normalizada' => fake()->unique()->bothify('??###??'),
            'visible' => true,
        ];
    }
}
