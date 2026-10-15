<?php

namespace Tests\Feature\Admin;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * UH20 (RF20, TC-54): an approved renewal never moves the validity backwards or grants free days.
 */
class RenewalApprovalDatesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
    }

    /**
     * @param  array<string, mixed>  $subscription
     */
    private function renewal(string $validUntil, array $subscription = []): ComprobantePago
    {
        $dealer = Concesionaria::factory()->active()->create();
        $suscripcion = Suscripcion::factory()->create([
            'concesionaria_id' => $dealer->id,
            'estado' => Suscripcion::ESTADO_ACTIVA,
            'vigente_desde' => '2026-09-01',
            'vigente_hasta' => $validUntil,
            ...$subscription,
        ]);

        // The period the dealer saw when uploading: the month after the validity.
        $from = $suscripcion->vigente_hasta->copy()->addDay();

        return ComprobantePago::factory()->create([
            'suscripcion_id' => $suscripcion->id,
            'periodo_desde' => $from,
            'periodo_hasta' => $from->copy()->addMonth(),
        ]);
    }

    private function approve(ComprobantePago $receipt): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->postJson("/api/admin/comprobantes/{$receipt->id}/aprobar")->assertOk();
    }

    public function test_tc54_renewal_approved_while_active_continues_from_the_end_of_the_validity(): void
    {
        $this->travelTo('2026-10-05 10:00:00');
        $receipt = $this->renewal('2026-10-10');

        $this->approve($receipt);

        $subscription = $receipt->suscripcion->fresh();
        $this->assertSame('2026-10-11', $subscription->vigente_desde->toDateString());
        $this->assertSame('2026-11-11', $subscription->vigente_hasta->toDateString());
        $this->assertSame(Suscripcion::ESTADO_ACTIVA, $subscription->estado);
    }

    public function test_tc54_renewal_approved_in_grace_gives_no_free_days_and_clears_the_grace_date(): void
    {
        $this->travelTo('2026-10-12 10:00:00');
        $receipt = $this->renewal('2026-10-10', ['gracia_hasta' => '2026-10-13']);

        $this->approve($receipt);

        $subscription = $receipt->suscripcion->fresh();
        $this->assertSame('2026-10-11', $subscription->vigente_desde->toDateString());
        $this->assertSame('2026-11-11', $subscription->vigente_hasta->toDateString());
        $this->assertNull($subscription->gracia_hasta);
    }

    public function test_the_receipt_keeps_the_period_that_was_applied(): void
    {
        $this->travelTo('2026-10-12 10:00:00');
        $receipt = $this->renewal('2026-10-10');
        $receipt->forceFill(['periodo_desde' => '2026-10-01', 'periodo_hasta' => '2026-10-31'])->save();

        $this->approve($receipt);

        $receipt->refresh();
        $this->assertSame('2026-10-11', $receipt->periodo_desde->toDateString());
        $this->assertSame('2026-11-11', $receipt->periodo_hasta->toDateString());
    }

    public function test_tc54_renewal_approved_after_inactivation_starts_today_and_republishes_vehicles(): void
    {
        $this->travelTo('2026-10-20 10:00:00');
        $receipt = $this->renewal('2026-10-10', [
            'estado' => Suscripcion::ESTADO_INACTIVA,
            'gracia_hasta' => '2026-10-13',
            'inactiva_desde' => '2026-10-14',
            'retencion_hasta' => '2026-11-13',
        ]);
        $vehicle = VehiculoConcesionaria::factory()->create([
            'concesionaria_id' => $receipt->suscripcion->concesionaria_id,
            'visible' => false,
            'ocultado_en' => '2026-10-14 09:00:00',
            'eliminar_desde' => '2026-11-13 00:00:00',
        ]);

        $this->approve($receipt);

        $subscription = $receipt->suscripcion->fresh();
        $this->assertSame(Suscripcion::ESTADO_ACTIVA, $subscription->estado);
        $this->assertSame('2026-10-20', $subscription->vigente_desde->toDateString());
        $this->assertSame('2026-11-20', $subscription->vigente_hasta->toDateString());
        $this->assertNull($subscription->gracia_hasta);
        $this->assertNull($subscription->inactiva_desde);
        $this->assertNull($subscription->retencion_hasta);
        $this->assertSame('2026-10-20', $receipt->fresh()->periodo_desde->toDateString());

        // Republishing the retained inventory is HU23 (TC-61).
        $vehicle->refresh();
        $this->assertTrue($vehicle->visible);
        $this->assertNull($vehicle->ocultado_en);
        $this->assertNull($vehicle->eliminar_desde);

        $this->actingAs($receipt->suscripcion->concesionaria->usuario)->getJson('/api/concesionaria/vehiculos')->assertOk();
    }

    public function test_tc54_renewal_approved_past_the_grace_period_before_the_command_ran_starts_today(): void
    {
        $this->travelTo('2026-10-20 10:00:00');
        $receipt = $this->renewal('2026-10-10');

        $this->approve($receipt);

        $subscription = $receipt->suscripcion->fresh();
        $this->assertSame('2026-10-20', $subscription->vigente_desde->toDateString());
        $this->assertSame('2026-11-20', $subscription->vigente_hasta->toDateString());
    }

    public function test_the_first_approval_keeps_the_period_of_the_receipt(): void
    {
        $this->travelTo('2026-10-16 10:00:00');
        $dealer = Concesionaria::factory()->create();
        $suscripcion = Suscripcion::factory()->create(['concesionaria_id' => $dealer->id]);
        $receipt = ComprobantePago::factory()->create([
            'suscripcion_id' => $suscripcion->id,
            'periodo_desde' => '2026-10-14',
            'periodo_hasta' => '2026-11-14',
        ]);

        $this->approve($receipt);

        $suscripcion->refresh();
        $this->assertSame('2026-10-14', $suscripcion->vigente_desde->toDateString());
        $this->assertSame('2026-11-14', $suscripcion->vigente_hasta->toDateString());
        $this->assertSame(Concesionaria::ESTADO_ACTIVA, $dealer->fresh()->estado_alta);
    }
}
