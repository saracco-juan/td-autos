<?php

namespace Database\Factories;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Suscripcion>
 */
class SuscripcionFactory extends Factory
{
    /**
     * Define the default state: created with the first receipt, not yet validated.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'concesionaria_id' => Concesionaria::factory(),
            'estado' => Suscripcion::ESTADO_PENDIENTE,
            'vigente_desde' => now()->toDateString(),
        ];
    }
}
