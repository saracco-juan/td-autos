<?php

namespace Tests\Feature\Favorites;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Support\VehiculoFields;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FavoriteStatusTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-10-20T12:00:00Z'));
        Http::preventStrayRequests();
        Http::fake(['https://dolarapi.com/v1/dolares/oficial' => Http::response([
            'moneda' => 'USD', 'casa' => 'oficial', 'venta' => 1000,
            'fechaActualizacion' => '2026-10-20T12:00:00Z',
        ])]);
    }

    public function test_favorite_status_is_owner_scoped_in_recommendations_and_detail(): void
    {
        $owner = $this->buyer();
        $other = $this->buyer();
        $vehicle = $this->listing();

        $this->actingAs($owner)->putJson("/api/favoritos/{$vehicle->id}")->assertNoContent();

        $this->actingAs($owner)->getJson('/api/recomendaciones')->assertOk()
            ->assertJsonPath('results.0.listing_id', $vehicle->id)
            ->assertJsonPath('results.0.is_favorite', true);
        $this->actingAs($other)->getJson('/api/recomendaciones')->assertOk()
            ->assertJsonPath('results.0.listing_id', $vehicle->id)
            ->assertJsonPath('results.0.is_favorite', false);

        $this->actingAs($owner)->getJson("/api/vehiculos/{$vehicle->id}")->assertOk()
            ->assertJsonPath('is_favorite', true);
        $this->actingAs($other)->getJson("/api/vehiculos/{$vehicle->id}")->assertOk()
            ->assertJsonPath('is_favorite', false);

        $this->actingAs($other)->getJson('/api/recomendaciones?usuario_id='.$owner->id)->assertOk()
            ->assertJsonPath('results.0.is_favorite', false);
        $this->getJson("/api/vehiculos/{$vehicle->id}?usuario_id={$owner->id}")->assertOk()
            ->assertJsonPath('is_favorite', false);
        $this->assertDatabaseCount('favorito', 1);
        $this->assertDatabaseHas('favorito', ['usuario_id' => $owner->id, 'vehiculo_id' => $vehicle->id]);
    }

    private function buyer(): User
    {
        $buyer = User::factory()->create(['rol' => User::ROL_COMPRADOR]);
        $this->actingAs($buyer)->putJson('/api/diagnostico', [
            'presupuesto' => '15m_25m', 'uso_principal' => 'ciudad', 'pasajeros' => '3_4',
            'kilometros_mensuales' => 'menos_500', 'transmision' => 'manual',
            'prioridad' => 'consumo', 'carrocerias' => [1],
        ])->assertOk();

        return $buyer;
    }

    private function listing(): Vehiculo
    {
        $dealer = Concesionaria::factory()->active()->create();
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa',
            'vigente_hasta' => now()->addMonth()->toDateString()]);
        $vehicle = Vehiculo::factory()->create(array_replace(array_fill_keys(array_keys(VehiculoFields::EQUIPMENT_FIELDS), true), [
            'tipo_carroceria_id' => 1, 'anio' => 2025, 'kilometraje' => 20000,
            'precio' => 20000000, 'moneda' => 'ARS', 'combustible' => 'nafta', 'transmision' => 'manual',
            'plazas' => 5, 'motor' => '1.6', 'turbo' => false, 'potencia' => 110, 'potencia_unidad' => 'CV',
            'consumo_urbano' => 6, 'consumo_ruta' => 5,
        ]));
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $vehicle->id, 'concesionaria_id' => $dealer->id]);

        return $vehicle;
    }
}
