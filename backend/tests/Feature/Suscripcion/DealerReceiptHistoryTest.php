<?php

namespace Tests\Feature\Suscripcion;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** UH18: dealers retain access to their own submitted payment receipts. */
class DealerReceiptHistoryTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/concesionaria/suscripcion/comprobantes';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.receipts_disk'));
    }

    private function receipt(Concesionaria $dealer, array $attributes = []): ComprobantePago
    {
        $subscription = $dealer->suscripcion()->first()
            ?? Suscripcion::factory()->create(['concesionaria_id' => $dealer->id]);

        return ComprobantePago::factory()->create([
            'suscripcion_id' => $subscription->id,
            ...$attributes,
        ]);
    }

    public function test_history_contains_only_own_receipts_newest_first_including_review_outcomes(): void
    {
        $dealer = Concesionaria::factory()->create();
        $old = $this->receipt($dealer, ['estado' => 'aprobado']);
        $new = $this->receipt($dealer, ['estado' => 'rechazado', 'archivo_url' => 'comprobantes/prueba.pdf']);
        $new->forceFill(['motivo_rechazo' => 'Falta el monto.', 'fecha_revision' => now()])->save();
        $this->receipt(Concesionaria::factory()->create());

        $this->actingAs($dealer->usuario)->getJson(self::URL)
            ->assertOk()->assertJsonCount(2)
            ->assertJsonPath('0.id', $new->id)
            ->assertJsonPath('0.nombre_archivo', 'prueba.pdf')
            ->assertJsonPath('0.estado', 'rechazado')
            ->assertJsonPath('0.motivo_rechazo', 'Falta el monto.')
            ->assertJsonPath('0.periodo_desde', $new->periodo_desde->toDateString())
            ->assertJsonPath('1.id', $old->id)
            ->assertJsonMissingPath('0.archivo_url');
    }

    public function test_history_is_empty_before_the_first_submission(): void
    {
        $dealer = Concesionaria::factory()->create();
        $this->actingAs($dealer->usuario)->getJson(self::URL)->assertOk()->assertExactJson([]);
    }

    public function test_guests_and_buyers_cannot_read_history_or_receipt_files(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->getJson(self::URL.'/1/archivo')->assertUnauthorized();
        $this->actingAs(User::factory()->create());
        $this->getJson(self::URL)->assertForbidden();
        $this->getJson(self::URL.'/1/archivo')->assertForbidden();
    }

    public function test_file_is_private_and_only_its_owner_can_download_it(): void
    {
        $dealer = Concesionaria::factory()->create();
        $receipt = $this->receipt($dealer, ['archivo_url' => 'comprobantes/local.pdf']);
        Storage::disk(config('filesystems.receipts_disk'))->put($receipt->archivo_url, '%PDF-1.4 local');

        $this->actingAs($dealer->usuario)->get(self::URL.'/'.$receipt->id.'/archivo')
            ->assertOk()->assertStreamedContent('%PDF-1.4 local');
        $other = Concesionaria::factory()->create();
        $this->actingAs($other->usuario)->getJson(self::URL.'/'.$receipt->id.'/archivo')->assertNotFound();
    }

    public function test_missing_file_returns_a_recoverable_not_found_response(): void
    {
        $dealer = Concesionaria::factory()->create();
        $receipt = $this->receipt($dealer);
        $this->actingAs($dealer->usuario)->getJson(self::URL.'/'.$receipt->id.'/archivo')
            ->assertNotFound()->assertJsonPath('message', 'No encontramos el archivo del comprobante.');
    }

    public function test_unknown_and_nonnumeric_file_ids_are_not_found_for_an_authenticated_dealer(): void
    {
        $dealer = Concesionaria::factory()->create();
        $this->actingAs($dealer->usuario)->getJson(self::URL.'/999999/archivo')->assertNotFound();
        $this->getJson(self::URL.'/abc/archivo')->assertNotFound();
    }
}
