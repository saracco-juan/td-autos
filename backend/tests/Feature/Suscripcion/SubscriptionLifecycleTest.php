<?php

namespace Tests\Feature\Suscripcion;

use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\Suscripcion;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Services\Inventario\VehiculoDestroyer;
use App\Services\Subscription\SubscriptionLifecycle;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SubscriptionLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function subscription(string $validUntil, string $state = Suscripcion::ESTADO_ACTIVA): Suscripcion
    {
        return Suscripcion::factory()->create([
            'concesionaria_id' => Concesionaria::factory()->active(),
            'estado' => $state,
            'vigente_desde' => '2026-09-01',
            'vigente_hasta' => $validUntil,
        ]);
    }

    private function vehicles(Suscripcion $subscription, int $count = 2): void
    {
        VehiculoConcesionaria::factory()->count($count)->create(['concesionaria_id' => $subscription->concesionaria_id]);
    }

    private function lifecycle(): SubscriptionLifecycle
    {
        return app(SubscriptionLifecycle::class);
    }

    public function test_tc52_effective_state_follows_the_date_rules(): void
    {
        $subscription = $this->subscription('2026-10-10');

        $cases = [
            '2026-10-10 23:59:00' => SubscriptionLifecycle::STATE_ACTIVE,
            '2026-10-11 00:00:00' => SubscriptionLifecycle::STATE_GRACE,
            '2026-10-13 23:59:00' => SubscriptionLifecycle::STATE_GRACE,
            '2026-10-14 00:00:00' => SubscriptionLifecycle::STATE_INACTIVE,
        ];

        foreach ($cases as $now => $expected) {
            $this->travelTo($now);
            $this->assertSame($expected, $this->lifecycle()->state($subscription), $now);
        }
    }

    public function test_tc52_grace_still_allows_inventory_and_inactive_does_not(): void
    {
        $subscription = $this->subscription('2026-10-10');

        $this->travelTo('2026-10-13 12:00:00');
        $this->assertTrue($this->lifecycle()->allowsInventory($subscription));
        $this->assertSame('2026-10-13', $this->lifecycle()->graceUntil($subscription)->toDateString());

        $this->travelTo('2026-10-14 12:00:00');
        $this->assertFalse($this->lifecycle()->allowsInventory($subscription));
    }

    public function test_pending_subscription_is_never_inactive(): void
    {
        $subscription = Suscripcion::factory()->create(['vigente_desde' => '2026-01-01']);
        $this->vehicles($subscription);

        $this->travelTo('2026-10-14 15:00:00');

        $this->assertSame(SubscriptionLifecycle::STATE_PENDING, $this->lifecycle()->state($subscription));
        $this->assertSame(0, $this->lifecycle()->process());
        $this->assertSame(Suscripcion::ESTADO_PENDIENTE, $subscription->fresh()->estado);
        $this->assertSame(2, VehiculoConcesionaria::where('visible', true)->count());
    }

    public function test_tc52_expired_less_than_three_days_ago_keeps_access_and_vehicles(): void
    {
        $subscription = $this->subscription('2026-10-11');
        $this->vehicles($subscription);

        $this->travelTo('2026-10-14 15:00:00');

        $this->assertSame(0, $this->lifecycle()->process());
        $subscription->refresh();
        $this->assertSame(Suscripcion::ESTADO_ACTIVA, $subscription->estado);
        $this->assertNull($subscription->inactiva_desde);
        $this->assertSame(2, VehiculoConcesionaria::where('visible', true)->count());
    }

    public function test_tc53_fourth_day_inactivates_the_subscription_and_hides_every_dealer_vehicle(): void
    {
        $subscription = $this->subscription('2026-10-10');
        $other = $this->subscription('2026-10-12');
        $this->vehicles($subscription, 3);
        $this->vehicles($other, 1);

        $this->travelTo('2026-10-14 15:00:00');

        $this->assertSame(1, $this->lifecycle()->process());

        $subscription->refresh();
        $this->assertSame(Suscripcion::ESTADO_INACTIVA, $subscription->estado);
        $this->assertSame('2026-10-13', $subscription->gracia_hasta->toDateString());
        $this->assertSame('2026-10-14', $subscription->inactiva_desde->toDateString());
        $this->assertSame('2026-11-13', $subscription->retencion_hasta->toDateString());

        $hidden = VehiculoConcesionaria::where('concesionaria_id', $subscription->concesionaria_id)->get();
        $this->assertCount(3, $hidden);
        foreach ($hidden as $row) {
            $this->assertFalse($row->visible);
            $this->assertSame('2026-10-14 15:00:00', $row->ocultado_en->toDateTimeString());
            $this->assertSame('2026-11-13 00:00:00', $row->eliminar_desde->toDateTimeString());
        }

        $this->assertSame(Suscripcion::ESTADO_ACTIVA, $other->fresh()->estado);
        $untouched = VehiculoConcesionaria::where('concesionaria_id', $other->concesionaria_id)->first();
        $this->assertTrue($untouched->visible);
        $this->assertNull($untouched->ocultado_en);
    }

    public function test_tc53_running_again_changes_nothing(): void
    {
        $subscription = $this->subscription('2026-10-10');
        $this->vehicles($subscription);

        $this->travelTo('2026-10-14 15:00:00');
        $this->lifecycle()->process();
        $before = [$subscription->fresh()->getAttributes(), VehiculoConcesionaria::all()->toArray()];

        $this->travelTo('2026-10-15 09:00:00');
        $this->assertSame(0, $this->lifecycle()->process());
        $this->assertSame($before, [$subscription->fresh()->getAttributes(), VehiculoConcesionaria::all()->toArray()]);
    }

    public function test_inactivating_keeps_vehicles_that_were_already_hidden_untouched(): void
    {
        $subscription = $this->subscription('2026-10-10');
        $hiddenBefore = VehiculoConcesionaria::factory()->create([
            'concesionaria_id' => $subscription->concesionaria_id,
            'visible' => false,
            'ocultado_en' => '2026-10-01 08:00:00',
            'eliminar_desde' => '2026-10-31 00:00:00',
        ]);
        $this->vehicles($subscription, 1);

        $this->travelTo('2026-10-14 15:00:00');
        $this->lifecycle()->process();

        $hiddenBefore->refresh();
        $this->assertSame('2026-10-01 08:00:00', $hiddenBefore->ocultado_en->toDateTimeString());
        $this->assertSame('2026-10-31 00:00:00', $hiddenBefore->eliminar_desde->toDateTimeString());
    }

    public function test_command_reports_how_many_subscriptions_it_inactivated(): void
    {
        $this->subscription('2026-10-10');
        $this->subscription('2026-10-01');
        $this->subscription('2026-10-13');

        $this->travelTo('2026-10-14 15:00:00');

        $this->artisan('suscripciones:procesar')
            ->expectsOutput('Suscripciones inactivadas: 2')
            ->assertSuccessful();
        $this->assertSame(2, Suscripcion::where('estado', Suscripcion::ESTADO_INACTIVA)->count());
    }

    private function hidden(Suscripcion $subscription, string $deleteFrom): VehiculoConcesionaria
    {
        return VehiculoConcesionaria::factory()->create([
            'concesionaria_id' => $subscription->concesionaria_id,
            'visible' => false,
            'ocultado_en' => '2026-10-14 09:00:00',
            'eliminar_desde' => $deleteFrom,
        ]);
    }

    public function test_tc62_purge_deletes_vehicles_whose_retention_ended_with_their_photo_files(): void
    {
        $disk = config('filesystems.vehicle_photos_disk');
        Storage::fake($disk);
        Storage::disk($disk)->put('vehiculos/gone.jpg', 'x');

        $subscription = $this->subscription('2026-10-10', Suscripcion::ESTADO_INACTIVA);
        $expired = $this->hidden($subscription, '2026-11-13 00:00:00');
        FotoVehiculo::factory()->create(['vehiculo_id' => $expired->vehiculo_id, 'ubicacion_archivo' => 'vehiculos/gone.jpg']);

        $this->travelTo('2026-11-13 00:00:00');

        $this->assertSame(1, $this->lifecycle()->purgeExpiredVehicles());
        $this->assertNull(Vehiculo::find($expired->vehiculo_id));
        $this->assertNull(VehiculoConcesionaria::find($expired->vehiculo_id));
        $this->assertSame(0, FotoVehiculo::count());
        Storage::disk($disk)->assertMissing('vehiculos/gone.jpg');
        // D4: the subscription stays inactive.
        $this->assertSame(Suscripcion::ESTADO_INACTIVA, $subscription->fresh()->estado);
    }

    public function test_tc62_purge_never_touches_vehicles_still_in_retention_or_visible_ones(): void
    {
        $subscription = $this->subscription('2026-10-10', Suscripcion::ESTADO_INACTIVA);
        $retained = $this->hidden($subscription, '2026-11-13 00:00:00');
        $this->vehicles($subscription, 2);

        $this->travelTo('2026-11-12 23:59:00');

        $this->assertSame(0, $this->lifecycle()->purgeExpiredVehicles());
        $this->assertNotNull(Vehiculo::find($retained->vehiculo_id));
        $this->assertSame(3, VehiculoConcesionaria::count());
    }

    public function test_tc62_purge_covers_every_dealer(): void
    {
        $first = $this->hidden($this->subscription('2026-10-10', Suscripcion::ESTADO_INACTIVA), '2026-11-13 00:00:00');
        $second = $this->hidden($this->subscription('2026-10-01', Suscripcion::ESTADO_INACTIVA), '2026-11-04 00:00:00');

        $this->travelTo('2026-12-01 10:00:00');

        $this->assertSame(2, $this->lifecycle()->purgeExpiredVehicles());
        $this->assertSame(0, VehiculoConcesionaria::count());
        $this->assertNull(Vehiculo::find($first->vehiculo_id));
        $this->assertNull(Vehiculo::find($second->vehiculo_id));
    }

    public function test_tc62_a_failing_vehicle_is_reported_and_does_not_block_the_rest(): void
    {
        $subscription = $this->subscription('2026-10-10', Suscripcion::ESTADO_INACTIVA);
        $broken = $this->hidden($subscription, '2026-11-13 00:00:00');
        $fine = $this->hidden($subscription, '2026-11-13 00:00:00');

        $real = new VehiculoDestroyer;
        $this->app->instance(VehiculoDestroyer::class, new class($real, $broken->vehiculo_id) extends VehiculoDestroyer
        {
            public function __construct(private readonly VehiculoDestroyer $real, private readonly int $failing) {}

            public function destroy(Vehiculo $vehiculo): void
            {
                if ($vehiculo->id === $this->failing) {
                    throw new \RuntimeException('boom');
                }

                $this->real->destroy($vehiculo);
            }
        });

        $this->travelTo('2026-12-01 10:00:00');

        $this->assertSame(1, $this->lifecycle()->purgeExpiredVehicles());
        $this->assertNotNull(Vehiculo::find($broken->vehiculo_id));
        $this->assertNull(Vehiculo::find($fine->vehiculo_id));
    }

    public function test_command_reports_how_many_vehicles_it_deleted(): void
    {
        $this->hidden($this->subscription('2026-10-10', Suscripcion::ESTADO_INACTIVA), '2026-11-13 00:00:00');

        $this->travelTo('2026-11-14 10:00:00');

        $this->artisan('suscripciones:procesar')
            ->expectsOutput('Suscripciones inactivadas: 0')
            ->expectsOutput('Vehículos eliminados: 1')
            ->assertSuccessful();
        $this->assertSame(0, VehiculoConcesionaria::count());
    }

    public function test_command_is_scheduled_hourly(): void
    {
        $event = collect(app(Schedule::class)->events())
            ->first(fn ($event) => str_contains($event->command, 'suscripciones:procesar'));

        $this->assertNotNull($event);
        $this->assertSame('0 * * * *', $event->expression);
    }
}
