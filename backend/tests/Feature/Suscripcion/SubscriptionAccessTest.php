<?php

namespace Tests\Feature\Suscripcion;

use App\Http\Middleware\EnsureDealerIsActive;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * UH20 (RF17, RF20, RF21, RF26): inventory access and the subscription state follow the dates.
 */
class SubscriptionAccessTest extends TestCase
{
    use RefreshDatabase;

    private const INVENTORY = '/api/concesionaria/vehiculos';

    private const SUBSCRIPTION = '/api/concesionaria/suscripcion';

    private function dealer(?string $validUntil, string $state = Suscripcion::ESTADO_ACTIVA): Concesionaria
    {
        $dealer = Concesionaria::factory()->active()->create();

        if ($validUntil !== null) {
            Suscripcion::factory()->create([
                'concesionaria_id' => $dealer->id,
                'estado' => $state,
                'vigente_desde' => '2026-09-01',
                'vigente_hasta' => $validUntil,
            ]);
        }

        return $dealer;
    }

    public function test_tc52_inside_the_grace_period_inventory_and_subscription_stay_open(): void
    {
        $dealer = $this->dealer('2026-10-11');
        VehiculoConcesionaria::factory()->count(2)->create(['concesionaria_id' => $dealer->id]);

        $this->travelTo('2026-10-14 12:00:00');

        $this->actingAs($dealer->usuario)->getJson(self::INVENTORY)->assertOk();
        $this->assertSame(2, VehiculoConcesionaria::where('visible', true)->count());

        $this->actingAs($dealer->usuario)->getJson(self::SUBSCRIPTION)
            ->assertOk()
            ->assertJsonPath('suscripcion', [
                'estado' => 'gracia',
                'vigente_desde' => '2026-09-01',
                'vigente_hasta' => '2026-10-11',
                'gracia_hasta' => '2026-10-14',
                'retencion_hasta' => null,
            ]);
    }

    public function test_an_active_subscription_reports_its_dates_and_last_grace_day(): void
    {
        $dealer = $this->dealer('2026-10-20');
        $this->travelTo('2026-10-14 12:00:00');

        $this->actingAs($dealer->usuario)->getJson(self::SUBSCRIPTION)
            ->assertJsonPath('suscripcion.estado', 'activa')
            ->assertJsonPath('suscripcion.gracia_hasta', '2026-10-23');
    }

    public function test_tc53_after_the_grace_period_inventory_is_blocked_and_vehicles_hidden_without_the_command(): void
    {
        $dealer = $this->dealer('2026-10-10');
        VehiculoConcesionaria::factory()->count(2)->create(['concesionaria_id' => $dealer->id]);

        $this->travelTo('2026-10-14 12:00:00');

        $this->actingAs($dealer->usuario)->getJson(self::INVENTORY)
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_INACTIVE_SUBSCRIPTION]);

        $this->assertSame(Suscripcion::ESTADO_INACTIVA, $dealer->suscripcion()->first()->estado);
        $this->assertSame(0, VehiculoConcesionaria::where('visible', true)->count());
    }

    public function test_tc53_every_inventory_route_is_blocked(): void
    {
        $dealer = $this->dealer('2026-10-10');
        $this->travelTo('2026-10-14 12:00:00');
        $this->actingAs($dealer->usuario);

        $this->postJson(self::INVENTORY)->assertForbidden();
        $this->getJson(self::INVENTORY.'/1')->assertForbidden();
        $this->deleteJson(self::INVENTORY.'/1')->assertForbidden();
        $this->postJson(self::INVENTORY.'/importar')->assertForbidden();
    }

    public function test_tc53_the_subscription_endpoints_stay_reachable_and_report_the_retention_deadline(): void
    {
        $dealer = $this->dealer('2026-10-10');
        $this->travelTo('2026-10-14 12:00:00');

        $this->actingAs($dealer->usuario)->getJson(self::SUBSCRIPTION)
            ->assertOk()
            ->assertJsonPath('estado_alta', Concesionaria::ESTADO_ACTIVA)
            ->assertJsonPath('suscripcion', [
                'estado' => 'inactiva',
                'vigente_desde' => '2026-09-01',
                'vigente_hasta' => '2026-10-10',
                'gracia_hasta' => '2026-10-13',
                'retencion_hasta' => '2026-11-13',
            ]);
    }

    public function test_the_subscription_screen_inactivates_on_read_too(): void
    {
        $dealer = $this->dealer('2026-10-10');
        VehiculoConcesionaria::factory()->create(['concesionaria_id' => $dealer->id]);
        $this->travelTo('2026-10-14 12:00:00');

        $this->actingAs($dealer->usuario)->getJson(self::SUBSCRIPTION)->assertOk();

        $this->assertSame(Suscripcion::ESTADO_INACTIVA, $dealer->suscripcion()->first()->estado);
        $this->assertSame(0, VehiculoConcesionaria::where('visible', true)->count());
    }

    public function test_an_active_dealer_without_validity_keeps_its_current_access(): void
    {
        $withoutSubscription = $this->dealer(null);
        $pending = Concesionaria::factory()->active()->create();
        Suscripcion::factory()->create(['concesionaria_id' => $pending->id]);

        $this->actingAs($withoutSubscription->usuario)->getJson(self::INVENTORY)->assertOk();
        $this->actingAs($pending->usuario)->getJson(self::INVENTORY)->assertOk();

        $this->actingAs($withoutSubscription->usuario)->getJson(self::SUBSCRIPTION)
            ->assertJsonPath('suscripcion', [
                'estado' => 'pendiente',
                'vigente_desde' => null,
                'vigente_hasta' => null,
                'gracia_hasta' => null,
                'retencion_hasta' => null,
            ]);
    }

    public function test_the_admin_counts_inactive_dealers_and_shows_the_effective_state(): void
    {
        $this->dealer('2026-09-01', Suscripcion::ESTADO_INACTIVA);
        $due = $this->dealer('2026-10-10');
        $grace = $this->dealer('2026-10-12');
        $this->dealer('2026-10-30');
        $this->travelTo('2026-10-14 12:00:00');
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->getJson('/api/admin/concesionarias')
            ->assertOk()
            ->assertJsonPath('conteos.inactivas', 2);

        $this->actingAs($admin)->getJson("/api/admin/concesionarias/{$due->id}")
            ->assertJsonPath('suscripcion.estado', 'inactiva')
            ->assertJsonPath('suscripcion.gracia_hasta', '2026-10-13')
            ->assertJsonPath('suscripcion.retencion_hasta', '2026-11-13');

        $this->actingAs($admin)->getJson("/api/admin/concesionarias/{$grace->id}")
            ->assertJsonPath('suscripcion.estado', 'gracia')
            ->assertJsonPath('suscripcion.gracia_hasta', '2026-10-15')
            ->assertJsonPath('suscripcion.vigente_hasta', '2026-10-12');
    }
}
