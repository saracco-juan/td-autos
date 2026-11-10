<?php

namespace Tests\Feature\VehicleDetail;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BuyerVehicleDetailTest extends TestCase
{
    use RefreshDatabase;

    private function listing(array $changes = []): Vehiculo
    {
        $dealer = Concesionaria::factory()->active()->create();
        Suscripcion::factory()->create([
            'concesionaria_id' => $dealer->id,
            'estado' => 'activa',
            'vigente_hasta' => now()->addMonth()->toDateString(),
        ]);
        $vehicle = Vehiculo::factory()->create($changes);
        VehiculoConcesionaria::factory()->create([
            'vehiculo_id' => $vehicle->id, 'concesionaria_id' => $dealer->id,
        ]);

        return $vehicle;
    }

    private function url(Vehiculo $vehicle): string
    {
        return "/api/vehiculos/{$vehicle->id}";
    }

    // HU09 / RF08 / TC-26: current facts and the complete ordered gallery, never private ownership.
    public function test_buyer_can_read_complete_public_detail_without_a_diagnosis(): void
    {
        Http::preventStrayRequests();
        $vehicle = $this->listing([
            'motor' => '2.0', 'potencia' => 170, 'potencia_unidad' => 'CV',
            'descripcion' => 'Único dueño', 'frenos_abs' => true,
            'turbo' => false, 'consumo_urbano' => 8.5, 'precio' => 20000000,
        ]);
        $vehicle->fotos()->create(['ubicacion_archivo' => 'https://example.test/second.jpg', 'orden' => 2]);
        $vehicle->fotos()->create(['ubicacion_archivo' => 'https://example.test/first.jpg', 'orden' => 1]);
        $before = $vehicle->fresh()->getAttributes();

        $response = $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]))->getJson($this->url($vehicle))
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('vehicle.id', $vehicle->id)
            ->assertJsonPath('vehicle.motor', '2.0')->assertJsonPath('vehicle.potencia', 170)
            ->assertJsonPath('vehicle.descripcion', 'Único dueño')->assertJsonPath('vehicle.frenos_abs', true)
            ->assertJsonPath('vehicle.turbo', false)->assertJsonPath('vehicle.consumo_urbano', 8.5)
            ->assertJsonPath('vehicle.precio', 20000000)->assertJsonCount(2, 'vehicle.fotos')
            ->assertJsonPath('vehicle.fotos.0.url', 'https://example.test/first.jpg')
            ->assertJsonPath('vehicle.fotos.1.url', 'https://example.test/second.jpg')
            ->assertJsonPath('dealer.id', $vehicle->propiedad->concesionaria_id);

        foreach (['patente', 'propiedad', 'acara_version_id', 'origen'] as $field) {
            $response->assertJsonMissingPath("vehicle.$field");
        }
        $this->assertSame(['id', 'nombre', 'provincia'], array_keys($response->json('dealer')));
        $this->assertSame($before, $vehicle->fresh()->getAttributes());
        $this->assertDatabaseCount('checklist_inspeccion', 0);
        Http::assertNothingSent();
    }

    // TC-27: user-approved dealer-only adaptation; unknown is not the same as absent.
    public function test_incomplete_detail_keeps_nulls_and_an_empty_gallery(): void
    {
        $vehicle = $this->listing([
            'version' => null, 'motor' => null, 'potencia' => null, 'descripcion' => null,
            'consumo_urbano' => null, 'frenos_abs' => null, 'aire_acondicionado' => false,
        ]);
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]))->getJson($this->url($vehicle))->assertOk()
            ->assertJsonPath('vehicle.motor', null)->assertJsonPath('vehicle.potencia', null)
            ->assertJsonPath('vehicle.version', null)->assertJsonPath('vehicle.descripcion', null)
            ->assertJsonPath('vehicle.consumo_urbano', null)->assertJsonPath('vehicle.frenos_abs', null)
            ->assertJsonPath('vehicle.aire_acondicionado', false)->assertJsonPath('vehicle.fotos', []);
    }

    // TC-77: checking the same URL again must not serve a withdrawn listing.
    public function test_hidden_or_deleted_listing_never_returns_obsolete_facts(): void
    {
        $vehicle = $this->listing();
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]))->getJson($this->url($vehicle))->assertOk();
        $vehicle->propiedad->update(['visible' => false]);
        $before = $vehicle->fresh()->getAttributes();
        $this->getJson($this->url($vehicle))->assertNotFound()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertExactJson(['message' => 'Esta publicación ya no está disponible.']);
        $this->assertSame($before, $vehicle->fresh()->getAttributes());
        $vehicle->propiedad->delete();
        $vehicle->delete();
        $this->getJson($this->url($vehicle))->assertNotFound();
    }

    public function test_dealer_approval_and_current_subscription_control_availability(): void
    {
        $vehicle = $this->listing();
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]));
        $dealer = $vehicle->propiedad->concesionaria;
        $subscription = Suscripcion::where('concesionaria_id', $dealer->id)->firstOrFail();
        $subscription->update(['vigente_hasta' => now()->subDays(3)->toDateString()]);
        $this->getJson($this->url($vehicle))->assertOk();
        $subscription->update(['vigente_hasta' => now()->subDays(4)->toDateString()]);
        $this->getJson($this->url($vehicle))->assertNotFound();
        $subscription->update(['vigente_hasta' => now()->addMonth()->toDateString(), 'estado' => 'pendiente']);
        $this->getJson($this->url($vehicle))->assertNotFound();
        $subscription->update(['estado' => 'activa']);
        $dealer->forceFill(['estado_alta' => Concesionaria::ESTADO_PENDIENTE])->save();
        $this->getJson($this->url($vehicle))->assertNotFound();
    }

    public function test_external_or_unowned_vehicles_are_not_public_dealer_listings(): void
    {
        Http::preventStrayRequests();
        $external = $this->listing(['origen' => 'externo']);
        $unowned = Vehiculo::factory()->create();
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]))->getJson($this->url($external))->assertNotFound();
        $this->getJson($this->url($unowned))->assertNotFound();
        $this->getJson('/api/vehiculos/999999')->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_only_authenticated_buyers_can_read_detail(): void
    {
        $vehicle = $this->listing();
        $this->getJson($this->url($vehicle))->assertUnauthorized();
        foreach ([User::ROL_CONCESIONARIA, User::ROL_ADMINISTRADOR] as $role) {
            $user = User::factory()->create(['rol' => $role]);
            $this->actingAs($user)->getJson($this->url($vehicle))->assertForbidden();
        }
    }
}
