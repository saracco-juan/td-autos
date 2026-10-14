<?php

namespace Tests\Feature\Suscripcion;

use App\Models\ComprobantePago;
use App\Models\Suscripcion;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ComprobantePagoModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_factory_creates_a_receipt_pending_review(): void
    {
        $comprobante = ComprobantePago::factory()->create();

        $this->assertSame('pendiente de revisión', ComprobantePago::ESTADO_PENDIENTE_REVISION);
        $this->assertSame(ComprobantePago::ESTADO_PENDIENTE_REVISION, $comprobante->estado);
        $this->assertInstanceOf(Suscripcion::class, $comprobante->suscripcion);
        $this->assertMatchesRegularExpression('#^comprobantes/\d+/[0-9a-f-]{36}\.pdf$#', $comprobante->archivo_url);
        $this->assertNull($comprobante->motivo_rechazo);
        $this->assertNull($comprobante->fecha_revision);
    }

    public function test_dates_are_cast_to_carbon(): void
    {
        $comprobante = ComprobantePago::factory()->create([
            'periodo_desde' => '2026-10-14',
            'periodo_hasta' => '2026-11-14',
            'fecha_de_pago' => '2026-10-14 10:30:00',
            'fecha_revision' => '2026-10-15 09:00:00',
        ])->fresh();

        foreach (['periodo_desde', 'periodo_hasta', 'fecha_de_pago', 'fecha_revision'] as $column) {
            $this->assertInstanceOf(CarbonInterface::class, $comprobante->{$column}, $column);
        }
        $this->assertSame('2026-11-14', $comprobante->periodo_hasta->toDateString());
        $this->assertSame('2026-10-14 10:30:00', $comprobante->fecha_de_pago->format('Y-m-d H:i:s'));
    }

    public function test_pendientes_scope_returns_only_receipts_pending_review(): void
    {
        $pending = ComprobantePago::factory()->create();
        ComprobantePago::factory()->create(['estado' => 'aprobado']);
        ComprobantePago::factory()->create(['estado' => 'rechazado']);

        $this->assertSame([$pending->id], ComprobantePago::pendientes()->pluck('id')->all());
    }
}
