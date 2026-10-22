<?php

namespace Database\Factories;

use App\Models\ComprobantePago;
use App\Models\Suscripcion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ComprobantePago>
 */
class ComprobantePagoFactory extends Factory
{
    /**
     * Define the default state: a receipt waiting for review.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'suscripcion_id' => Suscripcion::factory(),
            'periodo_desde' => now()->toDateString(),
            'periodo_hasta' => now()->addMonth()->toDateString(),
            'archivo_url' => 'comprobantes/'.fake()->numberBetween(1, 999).'/'.fake()->uuid().'.pdf',
            'estado' => ComprobantePago::ESTADO_PENDIENTE_REVISION,
            'fecha_de_pago' => now(),
        ];
    }
}
