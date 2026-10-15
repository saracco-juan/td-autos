<?php

namespace Tests\Feature\Admin;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\FotoVehiculo;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * UH23 (RF26, RF27, TC-61): approving the renewal of an inactive subscription publishes the retained
 * vehicles again, unless their retention already ended.
 */
class ReactivationRepublishTest extends TestCase
{
    use RefreshDatabase;

    private Concesionaria $dealer;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $this->dealer = Concesionaria::factory()->active()->create();
    }

    /**
     * A pending receipt for the dealer's subscription, already inactive since the day after grace.
     *
     * @param  array<string, mixed>  $subscription
     */
    private function receipt(array $subscription = []): ComprobantePago
    {
        $suscripcion = Suscripcion::factory()->create([
            'concesionaria_id' => $this->dealer->id,
            'estado' => Suscripcion::ESTADO_INACTIVA,
            'vigente_desde' => '2026-09-01',
            'vigente_hasta' => '2026-10-10',
            'gracia_hasta' => '2026-10-13',
            'inactiva_desde' => '2026-10-14',
            'retencion_hasta' => '2026-11-13',
            ...$subscription,
        ]);

        return ComprobantePago::factory()->create([
            'suscripcion_id' => $suscripcion->id,
            'periodo_desde' => '2026-10-11',
            'periodo_hasta' => '2026-11-11',
        ]);
    }

    private function hiddenVehicle(string $deleteFrom, ?Concesionaria $dealer = null): VehiculoConcesionaria
    {
        return VehiculoConcesionaria::factory()->create([
            'concesionaria_id' => ($dealer ?? $this->dealer)->id,
            'visible' => false,
            'ocultado_en' => '2026-10-14 09:00:00',
            'eliminar_desde' => $deleteFrom,
        ]);
    }

    private function approve(ComprobantePago $receipt): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->postJson("/api/admin/comprobantes/{$receipt->id}/aprobar")->assertOk();
    }

    public function test_tc61_approval_within_retention_publishes_every_retained_vehicle_again(): void
    {
        $this->travelTo('2026-10-20 10:00:00');
        $receipt = $this->receipt();
        $first = $this->hiddenVehicle('2026-11-13 00:00:00');
        $second = $this->hiddenVehicle('2026-11-13 00:00:00');
        $other = $this->hiddenVehicle('2026-11-13 00:00:00', Concesionaria::factory()->active()->create());

        $this->approve($receipt);

        foreach ([$first, $second] as $vehicle) {
            $vehicle->refresh();
            $this->assertTrue($vehicle->visible);
            $this->assertNull($vehicle->ocultado_en);
            $this->assertNull($vehicle->eliminar_desde);
        }

        // Another dealer's retention is its own.
        $this->assertFalse($other->fresh()->visible);
    }

    public function test_approval_after_retention_ended_deletes_expired_vehicles_and_republishes_the_rest(): void
    {
        $this->travelTo('2026-12-01 10:00:00');
        $disk = config('filesystems.vehicle_photos_disk');
        Storage::fake($disk);
        Storage::disk($disk)->put('vehiculos/expired.jpg', 'x');

        $receipt = $this->receipt();
        $expired = $this->hiddenVehicle('2026-11-13 00:00:00');
        FotoVehiculo::factory()->create(['vehiculo_id' => $expired->vehiculo_id, 'ubicacion_archivo' => 'vehiculos/expired.jpg']);
        $kept = $this->hiddenVehicle('2026-12-05 00:00:00');

        $this->approve($receipt);

        $this->assertNull(Vehiculo::find($expired->vehiculo_id));
        $this->assertNull(VehiculoConcesionaria::find($expired->vehiculo_id));
        Storage::disk($disk)->assertMissing('vehiculos/expired.jpg');
        $this->assertTrue($kept->fresh()->visible);
        $this->assertSame(Suscripcion::ESTADO_ACTIVA, $receipt->suscripcion->fresh()->estado);
    }

    public function test_approval_while_in_grace_leaves_the_vehicles_alone(): void
    {
        $this->travelTo('2026-10-12 10:00:00');
        $receipt = $this->receipt([
            'estado' => Suscripcion::ESTADO_ACTIVA,
            'gracia_hasta' => null,
            'inactiva_desde' => null,
            'retencion_hasta' => null,
        ]);
        $vehicle = $this->hiddenVehicle('2026-01-01 00:00:00');

        $this->approve($receipt);

        $this->assertNotNull(Vehiculo::find($vehicle->vehiculo_id));
        $this->assertFalse($vehicle->fresh()->visible);
    }
}
