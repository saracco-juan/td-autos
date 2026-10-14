<?php

namespace Database\Factories;

use App\Models\FotoVehiculo;
use App\Models\Vehiculo;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FotoVehiculo>
 */
class FotoVehiculoFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'vehiculo_id' => Vehiculo::factory(),
            'ubicacion_archivo' => 'vehiculos/'.fake()->uuid().'.jpg',
            'orden' => 1,
        ];
    }
}
