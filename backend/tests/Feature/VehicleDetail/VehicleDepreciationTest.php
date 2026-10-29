<?php

namespace Tests\Feature\VehicleDetail;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Services\Catalog\FixedAcaraCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class VehicleDepreciationTest extends TestCase
{
    use RefreshDatabase;

    private function listing(): Vehiculo
    {
        $dealer = Concesionaria::factory()->active()->create();
        Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, 'estado' => 'activa',
            'vigente_hasta' => now()->addMonth()->toDateString()]);
        $vehicle = Vehiculo::factory()->create(['marca' => 'Toyota', 'modelo' => 'Corolla',
            'version' => 'XEI', 'anio' => 2021, 'precio' => 20000, 'moneda' => 'USD',
            'acara_version_id' => 'toyota/corolla/xei']);
        VehiculoConcesionaria::factory()->create(['vehiculo_id' => $vehicle->id,
            'concesionaria_id' => $dealer->id]);

        return $vehicle;
    }

    private function catalog(array $values = [2020 => 8100, 2021 => 9000, 2022 => 10000]): void
    {
        Cache::store('catalog')->forever(FixedAcaraCatalog::cacheKey(), [
            'snapshot_id' => 'acara:2026-10-19', 'source_date' => '2026-10-19',
            'fetched_at' => now()->toIso8601String(), 'rows' => [[
                'make' => 'Toyota', 'model' => 'Corolla', 'version' => 'XEI',
                'version_id' => 'toyota/corolla/xei', 'currency' => 'ARS', 'values' => $values,
            ]],
        ]);
    }

    private function url(Vehiculo $vehicle): string
    {
        return "/api/vehiculos/{$vehicle->id}/depreciacion";
    }

    public function test_tc40_uses_published_price_and_hu05_rate_without_diagnosis_or_transfers(): void
    {
        Http::preventStrayRequests();
        $vehicle = $this->listing();
        $this->catalog();
        $before = $vehicle->fresh()->getAttributes();
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]))
            ->getJson($this->url($vehicle))->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('vehicle.id', $vehicle->id)
            ->assertJsonPath('projection.current_value', 20000)
            ->assertJsonPath('projection.currency', 'USD')
            ->assertJsonPath('projection.points.0.value', 18000)
            ->assertJsonPath('projection.points.1.value', 14580)
            ->assertJsonPath('projection.points.2.value', 11809.8)
            ->assertJsonPath('reference.years_used', [2020, 2021, 2022])
            ->assertJsonPath('reference.source_date', '2026-10-19')
            ->assertJsonMissingPath('vehicle.patente')
            ->assertJsonMissingPath('vehicle.acara_version_id');
        $this->assertSame($before, $vehicle->fresh()->getAttributes());
        Http::assertNothingSent();
    }

    public function test_tc41_missing_catalog_single_year_and_unknown_identity_are_normal_states(): void
    {
        $vehicle = $this->listing();
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]));
        $this->getJson($this->url($vehicle))->assertOk()->assertJsonPath('projection', null);
        $this->catalog([2021 => 10000]);
        $this->getJson($this->url($vehicle))->assertOk()->assertJsonPath('projection', null);
        $this->catalog();
        $vehicle->update(['acara_version_id' => 'unknown']);
        $this->getJson($this->url($vehicle))->assertOk()->assertJsonPath('projection', null);
    }

    public function test_withdrawn_external_and_unowned_listings_are_not_exposed(): void
    {
        $vehicle = $this->listing();
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]));
        $vehicle->propiedad->update(['visible' => false]);
        $before = $vehicle->fresh()->getAttributes();
        $this->getJson($this->url($vehicle))->assertNotFound()
            ->assertExactJson(['message' => 'Esta publicación ya no está disponible.']);
        $this->assertSame($before, $vehicle->fresh()->getAttributes());
        $vehicle->propiedad->update(['visible' => true]);
        $vehicle->update(['origen' => 'externo']);
        $this->getJson($this->url($vehicle))->assertNotFound();
        $this->getJson($this->url(Vehiculo::factory()->create()))->assertNotFound();
        $this->getJson('/api/vehiculos/999999/depreciacion')->assertNotFound();
    }

    public function test_inoperative_dealers_and_nonbuyers_cannot_access_projections(): void
    {
        $vehicle = $this->listing();
        $this->getJson($this->url($vehicle))->assertUnauthorized();
        foreach ([User::ROL_CONCESIONARIA, User::ROL_ADMINISTRADOR] as $role) {
            $this->actingAs(User::factory()->create(['rol' => $role]))
                ->getJson($this->url($vehicle))->assertForbidden();
        }
        $this->actingAs(User::factory()->create(['rol' => User::ROL_COMPRADOR]));
        $subscription = Suscripcion::where('concesionaria_id', $vehicle->propiedad->concesionaria_id)->firstOrFail();
        $subscription->update(['vigente_hasta' => now()->subDays(4)->toDateString()]);
        $this->getJson($this->url($vehicle))->assertNotFound();
        $subscription->update(['vigente_hasta' => now()->addMonth()->toDateString()]);
        $vehicle->propiedad->concesionaria->forceFill(['estado_alta' => Concesionaria::ESTADO_PENDIENTE])->save();
        $this->getJson($this->url($vehicle))->assertNotFound();
    }
}
