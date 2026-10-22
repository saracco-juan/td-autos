<?php

namespace Database\Factories;

use App\Models\Concesionaria;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Concesionaria>
 */
class ConcesionariaFactory extends Factory
{
    /**
     * Define the model's default state: a dealer waiting for approval.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'usuario_id' => User::factory()->dealer(),
            'nombre' => fake()->company(),
            'responsable_dni' => fake()->numerify('########'),
            'telefono_publico' => fake()->numerify('351 4##-####'),
            'telefono_responsable' => fake()->numerify('351 15#-######'),
            'direccion' => fake()->streetAddress(),
            'localidad' => fake()->randomElement(['Córdoba', 'Rosario', 'Mendoza', 'CABA']),
            'provincia' => fake()->randomElement(['Córdoba', 'Santa Fe', 'Mendoza', 'Buenos Aires']),
            'estado_alta' => Concesionaria::ESTADO_PENDIENTE,
            'creada_en' => now(),
        ];
    }

    /**
     * Indicate that an admin already approved the dealer.
     */
    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'estado_alta' => Concesionaria::ESTADO_ACTIVA,
        ]);
    }
}
