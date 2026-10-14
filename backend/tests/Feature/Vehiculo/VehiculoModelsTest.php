<?php

namespace Tests\Feature\Vehiculo;

use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class VehiculoModelsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_vehicle_stores_an_optional_description(): void
    {
        $vehiculo = Vehiculo::create(['origen' => 'concesionaria', 'descripcion' => 'Único dueño, service al día.']);
        $without = Vehiculo::factory()->create();

        $this->assertSame('Único dueño, service al día.', $vehiculo->fresh()->descripcion);
        $this->assertNull($without->fresh()->descripcion);
    }

    public function test_ownership_links_a_vehicle_to_its_dealer(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $vehiculo = Vehiculo::factory()->create();

        $propiedad = VehiculoConcesionaria::create([
            'vehiculo_id' => $vehiculo->id,
            'concesionaria_id' => $dealer->id,
            'patente_normalizada' => 'AB123CD',
            'visible' => true,
        ])->fresh();

        $this->assertSame($vehiculo->id, $propiedad->vehiculo_id);
        $this->assertTrue($propiedad->visible);
        $this->assertNull($propiedad->ocultado_en);
        $this->assertNull($propiedad->eliminar_desde);
        $this->assertTrue($propiedad->vehiculo->is($vehiculo));
        $this->assertTrue($propiedad->concesionaria->is($dealer));
        $this->assertTrue($vehiculo->propiedad->is($propiedad));
    }

    public function test_ownership_casts_its_dates(): void
    {
        $propiedad = VehiculoConcesionaria::factory()->create([
            'ocultado_en' => now(),
            'eliminar_desde' => now()->addDays(30),
        ])->fresh();

        $this->assertInstanceOf(Carbon::class, $propiedad->ocultado_en);
        $this->assertInstanceOf(Carbon::class, $propiedad->eliminar_desde);
    }

    public function test_a_plate_can_be_owned_only_once(): void
    {
        VehiculoConcesionaria::factory()->create(['patente_normalizada' => 'AB123CD']);

        $this->expectException(QueryException::class);
        VehiculoConcesionaria::factory()->create(['patente_normalizada' => 'AB123CD']);
    }

    public function test_a_dealer_reaches_only_its_own_vehicles(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $other = Concesionaria::factory()->active()->create();
        $own = VehiculoConcesionaria::factory()->create(['concesionaria_id' => $dealer->id]);
        $foreign = VehiculoConcesionaria::factory()->create(['concesionaria_id' => $other->id]);

        $this->assertSame([$own->vehiculo_id], $dealer->vehiculos()->pluck('vehiculo.id')->all());
        $this->assertTrue($dealer->vehiculos()->findOrFail($own->vehiculo_id)->is($own->vehiculo));
        $this->assertNull($dealer->vehiculos()->find($foreign->vehiculo_id));
        $this->assertSame(
            $own->patente_normalizada,
            $dealer->vehiculos()->first()->pivot->patente_normalizada,
        );
    }

    public function test_photos_come_back_in_upload_order(): void
    {
        $vehiculo = Vehiculo::factory()->create();
        $third = FotoVehiculo::factory()->create(['vehiculo_id' => $vehiculo->id, 'orden' => 3]);
        $first = FotoVehiculo::factory()->create(['vehiculo_id' => $vehiculo->id, 'orden' => 1]);
        $second = FotoVehiculo::factory()->create(['vehiculo_id' => $vehiculo->id, 'orden' => 2]);
        FotoVehiculo::factory()->create(['orden' => 1]);

        $this->assertSame([$first->id, $second->id, $third->id], $vehiculo->fotos->pluck('id')->all());
        $this->assertTrue($first->vehiculo->is($vehiculo));
    }
}
