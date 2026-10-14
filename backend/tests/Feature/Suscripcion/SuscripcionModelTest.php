<?php

namespace Tests\Feature\Suscripcion;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SuscripcionModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_factory_creates_a_pending_subscription_for_a_dealer(): void
    {
        $suscripcion = Suscripcion::factory()->create();

        $this->assertSame('pendiente', Suscripcion::ESTADO_PENDIENTE);
        $this->assertSame(Suscripcion::ESTADO_PENDIENTE, $suscripcion->estado);
        $this->assertInstanceOf(Concesionaria::class, $suscripcion->concesionaria);
        $this->assertNull($suscripcion->vigente_hasta);
    }

    public function test_dates_are_cast_to_carbon(): void
    {
        $suscripcion = Suscripcion::factory()->create([
            'vigente_desde' => '2026-10-14',
            'vigente_hasta' => '2026-11-14',
            'gracia_hasta' => '2026-11-20',
            'inactiva_desde' => '2026-11-21',
            'retencion_hasta' => '2027-02-21',
        ])->fresh();

        foreach (['vigente_desde', 'vigente_hasta', 'gracia_hasta', 'inactiva_desde', 'retencion_hasta'] as $column) {
            $this->assertInstanceOf(CarbonInterface::class, $suscripcion->{$column}, $column);
        }
        $this->assertSame('2026-11-14', $suscripcion->vigente_hasta->toDateString());
    }

    public function test_dealer_has_one_subscription(): void
    {
        $suscripcion = Suscripcion::factory()->create();

        $this->assertTrue($suscripcion->concesionaria->suscripcion->is($suscripcion));
        $this->assertNull(Concesionaria::factory()->create()->suscripcion);
    }

    public function test_subscription_has_many_receipts(): void
    {
        $suscripcion = Suscripcion::factory()->create();
        $comprobantes = ComprobantePago::factory()->count(2)->create(['suscripcion_id' => $suscripcion->id]);
        ComprobantePago::factory()->create();

        $this->assertEqualsCanonicalizing(
            $comprobantes->pluck('id')->all(),
            $suscripcion->comprobantes->pluck('id')->all(),
        );
    }

    public function test_dealer_reaches_its_receipts_through_the_subscription(): void
    {
        $suscripcion = Suscripcion::factory()->create();
        $comprobante = ComprobantePago::factory()->create(['suscripcion_id' => $suscripcion->id]);
        ComprobantePago::factory()->create();

        $this->assertSame([$comprobante->id], $suscripcion->concesionaria->comprobantes->pluck('id')->all());
    }
}
