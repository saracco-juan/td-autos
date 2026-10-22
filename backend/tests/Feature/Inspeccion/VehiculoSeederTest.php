<?php

namespace Tests\Feature\Inspeccion;

use App\Models\Vehiculo;
use Database\Seeders\VehiculoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VehiculoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeding_twice_does_not_duplicate_the_vehicles(): void
    {
        $this->seed(VehiculoSeeder::class);
        $this->seed(VehiculoSeeder::class);

        $this->assertSame(6, Vehiculo::where('origen', 'seed')->count());
        $this->assertSame(6, Vehiculo::count());
    }

    public function test_the_first_vehicle_is_the_corolla_from_the_wireframe(): void
    {
        $this->seed(VehiculoSeeder::class);

        $first = Vehiculo::orderBy('id')->firstOrFail();

        $this->assertSame('seed', $first->origen);
        $this->assertSame('Toyota', $first->marca);
        $this->assertSame('Corolla', $first->modelo);
        $this->assertSame('XEI', $first->version);
        $this->assertSame(2021, $first->anio);
        $this->assertSame(62000, $first->kilometraje);
        $this->assertSame('Automática', $first->transmision);
        $this->assertSame('Nafta', $first->combustible);
        $this->assertSame('CABA', $first->ubicacion);
    }
}
