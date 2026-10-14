<?php

namespace Tests\Feature\Suscripcion;

use App\Http\Middleware\EnsureDealerIsActive;
use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Notifications\PaymentReceiptSubmittedNotification;
use Illuminate\Contracts\Notifications\Dispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * UH18 (RF17, RF18, CU-16): bank transfer data and payment receipt upload.
 */
class SuscripcionEndpointsTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/concesionaria/suscripcion';

    private const UPLOAD_URL = '/api/concesionaria/suscripcion/comprobantes';

    private const ADMINS = ['admin1@tdautos.test', 'admin2@tdautos.test'];

    private string $disk;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-10-14 15:00:00');
        $this->disk = config('filesystems.receipts_disk');
        Storage::fake($this->disk);
        Notification::fake();

        config([
            'payments.transfer' => [
                'holder' => 'TD Autos SRL',
                'cuit' => '30-12345678-9',
                'bank' => 'Banco Nación',
                'cbu' => '0110000000000000000001',
                'alias' => 'tdautos.pagos',
                'monthly_amount' => '25000',
            ],
            'payments.admin_emails' => self::ADMINS,
        ]);
    }

    private function pdf(string $name = 'Transferencia Octubre.pdf', int $kb = 100): UploadedFile
    {
        return UploadedFile::fake()->create($name, $kb, 'application/pdf');
    }

    private function upload(Concesionaria $dealer, ?UploadedFile $file = null): TestResponse
    {
        return $this->actingAs($dealer->usuario)
            ->postJson(self::UPLOAD_URL, $file ? ['comprobante' => $file] : []);
    }

    private function pendingReceipt(Concesionaria $dealer, array $subscription = []): ComprobantePago
    {
        $suscripcion = Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, ...$subscription]);

        return ComprobantePago::factory()->create([
            'suscripcion_id' => $suscripcion->id,
            'archivo_url' => "comprobantes/{$dealer->id}/abc-123/transferencia-octubre.pdf",
            'fecha_de_pago' => '2026-10-14 15:00:00',
            'periodo_desde' => '2026-10-14',
            'periodo_hasta' => '2026-11-14',
        ]);
    }

    private function assertNothingStored(): void
    {
        $this->assertSame([], Storage::disk($this->disk)->allFiles());
        $this->assertSame(0, ComprobantePago::count());
        Notification::assertNothingSent();
    }

    // ---- access ----

    public function test_guest_is_unauthenticated_on_both_routes(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->postJson(self::UPLOAD_URL)->assertUnauthorized();
    }

    public function test_non_dealer_is_forbidden_on_both_routes(): void
    {
        $buyer = User::factory()->create()->fresh();

        $this->actingAs($buyer)->getJson(self::URL)
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_FORBIDDEN]);
        $this->actingAs($buyer)->postJson(self::UPLOAD_URL, ['comprobante' => $this->pdf()])
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_FORBIDDEN]);
        $this->assertNothingStored();
    }

    public function test_tc45_pending_dealer_is_still_forbidden_on_inventory(): void
    {
        $dealer = Concesionaria::factory()->create();

        $this->actingAs($dealer->usuario)->getJson('/api/concesionaria/vehiculos')
            ->assertForbidden()
            ->assertExactJson(['message' => EnsureDealerIsActive::MESSAGE_PENDING]);
    }

    // ---- GET ----

    public function test_get_for_pending_dealer_without_receipt(): void
    {
        $dealer = Concesionaria::factory()->create();

        $this->actingAs($dealer->usuario)->getJson(self::URL)
            ->assertOk()
            ->assertExactJson([
                'estado_alta' => 'pendiente',
                'tipo_pago' => 'alta',
                'transferencia' => [
                    'titular' => 'TD Autos SRL',
                    'cuit' => '30-12345678-9',
                    'banco' => 'Banco Nación',
                    'cbu' => '0110000000000000000001',
                    'alias' => 'tdautos.pagos',
                    'monto_mensual' => '25000',
                ],
                'comprobante_pendiente' => null,
            ]);
    }

    public function test_get_for_pending_dealer_with_pending_receipt(): void
    {
        $dealer = Concesionaria::factory()->create();
        $receipt = $this->pendingReceipt($dealer);

        $this->actingAs($dealer->usuario)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('comprobante_pendiente', [
                'id' => $receipt->id,
                'nombre_archivo' => 'transferencia-octubre.pdf',
                'enviado_en' => '2026-10-14T15:00:00+00:00',
                'tipo' => 'alta',
                'periodo_desde' => '2026-10-14',
                'periodo_hasta' => '2026-11-14',
            ]);
    }

    public function test_get_ignores_receipts_that_are_not_pending_and_other_dealers(): void
    {
        $dealer = Concesionaria::factory()->create();
        $reviewed = $this->pendingReceipt($dealer);
        $reviewed->update(['estado' => 'aprobado']);
        $this->pendingReceipt(Concesionaria::factory()->create());

        $this->actingAs($dealer->usuario)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('comprobante_pendiente', null);
    }

    public function test_get_for_active_dealer_reports_renewal(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        $this->pendingReceipt($dealer, ['vigente_hasta' => '2026-10-31']);

        $this->actingAs($dealer->usuario)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('estado_alta', 'activa')
            ->assertJsonPath('tipo_pago', 'renovacion')
            ->assertJsonPath('comprobante_pendiente.tipo', 'renovacion');
    }

    public function test_get_shows_null_transfer_when_data_is_incomplete(): void
    {
        config(['payments.transfer.cbu' => null]);
        $dealer = Concesionaria::factory()->create();

        $this->actingAs($dealer->usuario)->getJson(self::URL)
            ->assertOk()
            ->assertJsonPath('transferencia', null);
    }

    // ---- POST ----

    public function test_tc47_pending_dealer_uploads_a_pdf(): void
    {
        $dealer = Concesionaria::factory()->create(['nombre' => 'Autos del Sur']);

        $response = $this->upload($dealer, $this->pdf());

        $response->assertCreated()
            ->assertJsonPath('estado_alta', 'pendiente')
            ->assertJsonPath('tipo_pago', 'alta')
            ->assertJsonPath('transferencia.alias', 'tdautos.pagos')
            ->assertJsonPath('comprobante_pendiente.nombre_archivo', 'transferencia-octubre.pdf')
            ->assertJsonPath('comprobante_pendiente.tipo', 'alta')
            ->assertJsonPath('comprobante_pendiente.periodo_desde', '2026-10-14')
            ->assertJsonPath('comprobante_pendiente.periodo_hasta', '2026-11-14');

        $suscripcion = $dealer->fresh()->suscripcion;
        $this->assertSame('pendiente', $suscripcion->estado);
        $this->assertSame('2026-10-14', $suscripcion->vigente_desde->toDateString());

        $receipt = $suscripcion->comprobantes()->sole();
        $this->assertSame(ComprobantePago::ESTADO_PENDIENTE_REVISION, $receipt->estado);
        $this->assertSame('2026-10-14 15:00:00', $receipt->fecha_de_pago->format('Y-m-d H:i:s'));
        $this->assertMatchesRegularExpression(
            "#^comprobantes/{$dealer->id}/[0-9a-f-]{36}/transferencia-octubre\.pdf$#",
            $receipt->archivo_url,
        );
        Storage::disk($this->disk)->assertExists($receipt->archivo_url);
        $this->assertSame([$receipt->archivo_url], Storage::disk($this->disk)->allFiles());

        foreach (self::ADMINS as $email) {
            Notification::assertSentOnDemand(
                PaymentReceiptSubmittedNotification::class,
                fn ($notification, $channels, AnonymousNotifiable $notifiable) => in_array($email, $notifiable->routes['mail'], true),
            );
        }
    }

    public function test_notification_mail_describes_the_receipt_and_attaches_the_file(): void
    {
        $dealer = Concesionaria::factory()->create(['nombre' => 'Autos del Sur']);
        $this->upload($dealer, $this->pdf())->assertCreated();

        Notification::assertSentOnDemand(
            PaymentReceiptSubmittedNotification::class,
            function (PaymentReceiptSubmittedNotification $notification, $channels, AnonymousNotifiable $notifiable) {
                $mail = $notification->toMail($notifiable);
                $text = implode("\n", $mail->introLines);

                $this->assertSame('Nuevo comprobante de pago de Autos del Sur', $mail->subject);
                $this->assertStringContainsString('Autos del Sur', $text);
                $this->assertStringContainsString('Alta inicial', $text);
                $this->assertStringContainsString('14/10/2026', $text);
                $this->assertCount(1, $mail->rawAttachments);
                $this->assertSame('transferencia-octubre.pdf', $mail->rawAttachments[0]['name']);

                return true;
            },
        );
    }

    public function test_upload_reuses_the_existing_subscription(): void
    {
        $dealer = Concesionaria::factory()->create();
        $suscripcion = Suscripcion::factory()->create(['concesionaria_id' => $dealer->id]);

        $this->upload($dealer, $this->pdf())->assertCreated();

        $this->assertSame(1, Suscripcion::count());
        $this->assertSame($suscripcion->id, ComprobantePago::sole()->suscripcion_id);
    }

    public function test_renewal_period_starts_the_day_after_the_current_validity(): void
    {
        $dealer = Concesionaria::factory()->active()->create();
        Suscripcion::factory()->create([
            'concesionaria_id' => $dealer->id,
            'estado' => 'activa',
            'vigente_hasta' => '2026-10-31',
        ]);

        $this->upload($dealer, $this->pdf())
            ->assertCreated()
            ->assertJsonPath('tipo_pago', 'renovacion')
            ->assertJsonPath('comprobante_pendiente.tipo', 'renovacion')
            ->assertJsonPath('comprobante_pendiente.periodo_desde', '2026-11-01')
            ->assertJsonPath('comprobante_pendiente.periodo_hasta', '2026-12-01');
    }

    public function test_tc48_unsupported_format_is_rejected(): void
    {
        $dealer = Concesionaria::factory()->create();

        $this->upload($dealer, UploadedFile::fake()->create('virus.exe', 100, 'application/x-msdownload'))
            ->assertUnprocessable()
            ->assertJsonPath('errors.comprobante.0', 'El comprobante tiene que ser PDF, JPG o PNG.');
        $this->assertNothingStored();
    }

    public function test_extension_and_content_must_both_match(): void
    {
        $dealer = Concesionaria::factory()->create();

        $this->upload($dealer, UploadedFile::fake()->create('fake.pdf', 100, 'application/x-msdownload'))
            ->assertUnprocessable()
            ->assertJsonPath('errors.comprobante.0', 'El comprobante tiene que ser PDF, JPG o PNG.');
        $this->assertNothingStored();
    }

    public function test_images_are_accepted(): void
    {
        $dealer = Concesionaria::factory()->create();

        $this->upload($dealer, UploadedFile::fake()->create('foto.png', 100, 'image/png'))->assertCreated();
        $this->assertStringEndsWith('/foto.png', ComprobantePago::sole()->archivo_url);
    }

    public function test_tc81_missing_file_is_rejected(): void
    {
        $dealer = Concesionaria::factory()->create();

        $this->upload($dealer)
            ->assertUnprocessable()
            ->assertJsonPath('errors.comprobante.0', 'Adjuntá el comprobante.');
        $this->assertNothingStored();
    }

    public function test_file_over_5_mb_is_rejected(): void
    {
        $dealer = Concesionaria::factory()->create();

        $this->upload($dealer, $this->pdf('grande.pdf', 5121))
            ->assertUnprocessable()
            ->assertJsonPath('errors.comprobante.0', 'El comprobante no puede superar los 5 MB.');
        $this->assertNothingStored();
    }

    public function test_second_upload_while_one_is_pending_is_a_conflict(): void
    {
        $dealer = Concesionaria::factory()->create();
        $this->pendingReceipt($dealer);

        $this->upload($dealer, $this->pdf())
            ->assertStatus(409)
            ->assertExactJson(['message' => 'Ya tenés un comprobante en revisión.']);

        $this->assertSame(1, ComprobantePago::count());
        $this->assertSame([], Storage::disk($this->disk)->allFiles());
        Notification::assertNothingSent();
    }

    public function test_incomplete_transfer_data_blocks_the_upload(): void
    {
        config(['payments.transfer.holder' => '']);
        $dealer = Concesionaria::factory()->create();

        $this->upload($dealer, $this->pdf())
            ->assertStatus(503)
            ->assertExactJson(['message' => 'Los datos de transferencia no están disponibles por el momento.']);
        $this->assertNothingStored();
        $this->assertSame(0, Suscripcion::count());
    }

    public function test_without_admin_emails_nothing_is_sent_and_a_warning_is_logged(): void
    {
        config(['payments.admin_emails' => []]);
        Log::spy();
        $dealer = Concesionaria::factory()->create();

        $this->upload($dealer, $this->pdf())->assertCreated();

        Notification::assertNothingSent();
        Log::shouldHaveReceived('warning')->once();
        $this->assertSame(1, ComprobantePago::count());
    }

    public function test_notification_failure_keeps_the_receipt_and_answers_created(): void
    {
        $this->mock(Dispatcher::class)
            ->shouldReceive('send')
            ->andThrow(new \RuntimeException('mail down'));
        $dealer = Concesionaria::factory()->create();

        $this->upload($dealer, $this->pdf())->assertCreated();

        $receipt = ComprobantePago::sole();
        Storage::disk($this->disk)->assertExists($receipt->archivo_url);
    }

    public function test_database_failure_deletes_the_stored_file(): void
    {
        $dealer = Concesionaria::factory()->create();
        ComprobantePago::creating(fn () => throw new \RuntimeException('db down'));

        $this->withoutExceptionHandling();
        try {
            $this->upload($dealer, $this->pdf());
            $this->fail('The exception should have been rethrown.');
        } catch (\RuntimeException $e) {
            $this->assertSame('db down', $e->getMessage());
        }

        $this->assertSame([], Storage::disk($this->disk)->allFiles());
        $this->assertSame(0, Suscripcion::count());
    }
}
