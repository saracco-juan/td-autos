<?php

namespace Tests\Feature\Admin;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * UH19 (RF19, CU-17): the administrator lists the dealers and opens a payment receipt to review it.
 */
class AdminDealersAndReceiptsTest extends TestCase
{
    use RefreshDatabase;

    private const LIST_URL = '/api/admin/concesionarias';

    private string $disk;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-10-14 15:00:00');
        $this->disk = config('filesystems.receipts_disk');
        Storage::fake($this->disk);
    }

    private function admin(): User
    {
        return User::factory()->admin()->create();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function receipt(Concesionaria $dealer, array $attributes = []): ComprobantePago
    {
        $suscripcion = $dealer->suscripcion()->first()
            ?? Suscripcion::factory()->create(['concesionaria_id' => $dealer->id]);

        return ComprobantePago::factory()->create([
            'suscripcion_id' => $suscripcion->id,
            'archivo_url' => "comprobantes/{$dealer->id}/abc-123/transferencia-octubre.pdf",
            'fecha_de_pago' => '2026-10-14 15:00:00',
            'periodo_desde' => '2026-10-14',
            'periodo_hasta' => '2026-11-14',
            ...$attributes,
        ]);
    }

    private function receiptUrl(ComprobantePago $receipt, string $suffix = ''): string
    {
        return "/api/admin/comprobantes/{$receipt->id}{$suffix}";
    }

    /**
     * @return array<string, array{string}>
     */
    public static function adminUrls(): array
    {
        return [
            'dealer list' => [self::LIST_URL],
            'receipt detail' => ['/api/admin/comprobantes/{id}'],
            'receipt file' => ['/api/admin/comprobantes/{id}/archivo'],
        ];
    }

    #[DataProvider('adminUrls')]
    public function test_guests_are_unauthenticated(string $url): void
    {
        $receipt = $this->receipt(Concesionaria::factory()->create());

        $this->getJson(str_replace('{id}', (string) $receipt->id, $url))->assertUnauthorized();
    }

    #[DataProvider('adminUrls')]
    public function test_buyers_and_dealers_are_forbidden(string $url): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $receipt = $this->receipt($dealer);
        $url = str_replace('{id}', (string) $receipt->id, $url);

        $this->actingAs(User::factory()->create())->getJson($url)->assertForbidden();
        $this->actingAs($dealer->usuario)->getJson($url)->assertForbidden();
    }

    public function test_non_admins_are_forbidden_before_the_receipt_is_looked_up(): void
    {
        $this->actingAs(User::factory()->create())
            ->getJson('/api/admin/comprobantes/999')
            ->assertForbidden();
    }

    public function test_lists_dealers_with_pending_receipts_first_then_by_name_and_counts_states(): void
    {
        $zeta = Concesionaria::factory()->create(['nombre' => 'Zeta Autos', 'localidad' => 'Rosario']);
        Concesionaria::factory()->active()->create(['nombre' => 'Alfa Motors']);
        Concesionaria::factory()->create(['nombre' => 'Beta Cars']);
        $gama = Concesionaria::factory()->active()->create(['nombre' => 'Gama Usados']);

        $pending = $this->receipt($zeta);
        $approved = $this->receipt($gama, ['estado' => ComprobantePago::ESTADO_APROBADO]);

        $response = $this->actingAs($this->admin())->getJson(self::LIST_URL)->assertOk();

        $response->assertJsonPath('conteos', ['activas' => 2, 'pendientes' => 2, 'inactivas' => 0]);
        $this->assertSame(
            ['Zeta Autos', 'Alfa Motors', 'Beta Cars', 'Gama Usados'],
            array_column($response->json('concesionarias'), 'nombre'),
        );

        $response->assertJsonPath('concesionarias.0', [
            'id' => $zeta->id,
            'nombre' => 'Zeta Autos',
            'localidad' => 'Rosario',
            'provincia' => $zeta->provincia,
            'estado_alta' => Concesionaria::ESTADO_PENDIENTE,
            'contacto' => [
                'email' => $zeta->usuario->email,
                'telefono' => $zeta->telefono_responsable,
            ],
            'comprobante_pendiente_id' => $pending->id,
            'ultimo_comprobante_id' => $pending->id,
            'ultimo_comprobante_estado' => ComprobantePago::ESTADO_PENDIENTE_REVISION,
        ]);
        $response->assertJsonPath('concesionarias.2.comprobante_pendiente_id', null);
        $response->assertJsonPath('concesionarias.2.ultimo_comprobante_id', null);
        $response->assertJsonPath('concesionarias.2.ultimo_comprobante_estado', null);
        $response->assertJsonPath('concesionarias.3.comprobante_pendiente_id', null);
        $response->assertJsonPath('concesionarias.3.ultimo_comprobante_id', $approved->id);
        $response->assertJsonPath('concesionarias.3.ultimo_comprobante_estado', ComprobantePago::ESTADO_APROBADO);
    }

    public function test_lists_the_state_of_the_latest_receipt_when_it_was_rejected(): void
    {
        $dealer = Concesionaria::factory()->create(['nombre' => 'Delta Autos']);
        $this->receipt($dealer, ['estado' => ComprobantePago::ESTADO_APROBADO]);
        $rejected = $this->receipt($dealer, ['estado' => ComprobantePago::ESTADO_RECHAZADO]);

        $this->actingAs($this->admin())
            ->getJson(self::LIST_URL)
            ->assertOk()
            ->assertJsonPath('concesionarias.0.estado_alta', Concesionaria::ESTADO_PENDIENTE)
            ->assertJsonPath('concesionarias.0.comprobante_pendiente_id', null)
            ->assertJsonPath('concesionarias.0.ultimo_comprobante_id', $rejected->id)
            ->assertJsonPath('concesionarias.0.ultimo_comprobante_estado', ComprobantePago::ESTADO_RECHAZADO);
    }

    public function test_list_is_empty_without_dealers(): void
    {
        $this->actingAs($this->admin())
            ->getJson(self::LIST_URL)
            ->assertOk()
            ->assertExactJson([
                'conteos' => ['activas' => 0, 'pendientes' => 0, 'inactivas' => 0],
                'concesionarias' => [],
            ]);
    }

    public function test_shows_the_receipt_detail_with_its_dealer(): void
    {
        $dealer = Concesionaria::factory()->create(['nombre' => 'Zeta Autos', 'localidad' => 'Rosario']);
        $receipt = $this->receipt($dealer);

        $this->actingAs($this->admin())
            ->getJson($this->receiptUrl($receipt))
            ->assertOk()
            ->assertExactJson([
                'id' => $receipt->id,
                'estado' => ComprobantePago::ESTADO_PENDIENTE_REVISION,
                'tipo' => 'alta',
                'periodo_desde' => '2026-10-14',
                'periodo_hasta' => '2026-11-14',
                'enviado_en' => '2026-10-14T15:00:00+00:00',
                'nombre_archivo' => 'transferencia-octubre.pdf',
                'archivo_url' => url($this->receiptUrl($receipt, '/archivo')),
                'motivo_rechazo' => null,
                'fecha_revision' => null,
                'concesionaria' => [
                    'id' => $dealer->id,
                    'nombre' => 'Zeta Autos',
                    'localidad' => 'Rosario',
                    'provincia' => $dealer->provincia,
                    'estado_alta' => Concesionaria::ESTADO_PENDIENTE,
                    'contacto' => [
                        'email' => $dealer->usuario->email,
                        'telefono' => $dealer->telefono_responsable,
                    ],
                ],
            ]);
    }

    public function test_a_receipt_after_an_approved_one_is_a_renewal(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $first = $this->receipt($dealer, ['estado' => ComprobantePago::ESTADO_APROBADO]);
        $second = $this->receipt($dealer, ['periodo_desde' => '2026-11-15', 'periodo_hasta' => '2026-12-15']);

        $this->actingAs($admin = $this->admin())->getJson($this->receiptUrl($first))->assertJsonPath('tipo', 'alta');
        $this->actingAs($admin)->getJson($this->receiptUrl($second))->assertJsonPath('tipo', 'renovacion');
    }

    public function test_unknown_receipt_is_not_found(): void
    {
        $this->actingAs($this->admin())->getJson('/api/admin/comprobantes/999')->assertNotFound();
    }

    public function test_streams_the_receipt_file_inline(): void
    {
        $receipt = $this->receipt(Concesionaria::factory()->create());
        Storage::disk($this->disk)->put($receipt->archivo_url, '%PDF-1.4 contenido');

        $response = $this->actingAs($this->admin())->get($this->receiptUrl($receipt, '/archivo'))->assertOk();

        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringStartsWith('inline', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('transferencia-octubre.pdf', $response->headers->get('Content-Disposition'));
        $this->assertSame('%PDF-1.4 contenido', $response->streamedContent());
    }

    public function test_missing_receipt_file_is_not_found(): void
    {
        $receipt = $this->receipt(Concesionaria::factory()->create());

        $this->actingAs($this->admin())
            ->getJson($this->receiptUrl($receipt, '/archivo'))
            ->assertNotFound()
            ->assertJsonPath('message', 'No encontramos el archivo del comprobante.');
    }
}
