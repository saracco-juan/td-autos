<?php

namespace Tests\Feature\Admin;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Notifications\PaymentReceiptReviewedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * UH19 (RF19, RF33, CU-17): the administrator approves or rejects a payment receipt.
 */
class AdminReceiptDecisionTest extends TestCase
{
    use RefreshDatabase;

    private const REASON = 'El monto transferido no coincide con la cuota mensual.';

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-10-16 10:00:00');
        Storage::fake(config('filesystems.receipts_disk'));
        Notification::fake();
    }

    /**
     * @param  array<string, mixed>  $subscription
     */
    private function pendingReceipt(Concesionaria $dealer, array $subscription = [], string $from = '2026-10-14', string $to = '2026-11-14'): ComprobantePago
    {
        $suscripcion = Suscripcion::factory()->create(['concesionaria_id' => $dealer->id, ...$subscription]);

        return ComprobantePago::factory()->create([
            'suscripcion_id' => $suscripcion->id,
            'periodo_desde' => $from,
            'periodo_hasta' => $to,
        ]);
    }

    private function approve(User $admin, ComprobantePago $receipt): TestResponse
    {
        return $this->actingAs($admin)->postJson("/api/admin/comprobantes/{$receipt->id}/aprobar");
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function reject(User $admin, ComprobantePago $receipt, array $body): TestResponse
    {
        return $this->actingAs($admin)->postJson("/api/admin/comprobantes/{$receipt->id}/rechazar", $body);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function decisions(): array
    {
        return ['approve' => ['aprobar'], 'reject' => ['rechazar']];
    }

    #[DataProvider('decisions')]
    public function test_only_administrators_can_decide(string $action): void
    {
        $dealer = Concesionaria::factory()->create();
        $receipt = $this->pendingReceipt($dealer);
        $url = "/api/admin/comprobantes/{$receipt->id}/{$action}";
        $body = ['motivo_rechazo' => self::REASON];

        $this->postJson($url, $body)->assertUnauthorized();
        $this->actingAs(User::factory()->create())->postJson($url, $body)->assertForbidden();
        $this->actingAs($dealer->usuario)->postJson($url, $body)->assertForbidden();

        $this->assertSame(ComprobantePago::ESTADO_PENDIENTE_REVISION, $receipt->fresh()->estado);
    }

    /**
     * TC-49 (and TC-70): approving the first receipt activates the dealer for the paid period.
     */
    public function test_tc49_approving_the_first_receipt_activates_the_dealer_and_sets_the_period(): void
    {
        $admin = User::factory()->admin()->create();
        $dealer = Concesionaria::factory()->create();
        $receipt = $this->pendingReceipt($dealer);

        $this->approve($admin, $receipt)
            ->assertOk()
            ->assertJsonPath('id', $receipt->id)
            ->assertJsonPath('estado', ComprobantePago::ESTADO_APROBADO)
            ->assertJsonPath('fecha_revision', '2026-10-16T10:00:00+00:00')
            ->assertJsonPath('concesionaria.estado_alta', Concesionaria::ESTADO_ACTIVA);

        $receipt->refresh();
        $this->assertSame(ComprobantePago::ESTADO_APROBADO, $receipt->estado);
        $this->assertSame($admin->id, $receipt->revisado_por_admin_id);
        $this->assertSame('2026-10-16 10:00:00', $receipt->fecha_revision->toDateTimeString());
        $this->assertNull($receipt->motivo_rechazo);

        $suscripcion = $receipt->suscripcion;
        $this->assertSame(Suscripcion::ESTADO_ACTIVA, $suscripcion->estado);
        $this->assertSame('2026-10-14', $suscripcion->vigente_desde->toDateString());
        $this->assertSame('2026-11-14', $suscripcion->vigente_hasta->toDateString());
        $this->assertSame(Concesionaria::ESTADO_ACTIVA, $dealer->fresh()->estado_alta);

        Notification::assertSentTo($dealer->usuario, PaymentReceiptReviewedNotification::class, function ($notification, $channels, $notifiable) {
            $mail = $notification->toMail($notifiable);

            return $channels === ['mail']
                && $mail->subject === 'Aprobamos tu comprobante de pago'
                && in_array('Tu suscripción está vigente del 14/10/2026 al 14/11/2026.', $mail->introLines, true)
                && in_array('Tu concesionaria ya está activa: ya podés gestionar tu inventario.', $mail->introLines, true);
        });

        // The approved dealer can now reach the inventory.
        $this->actingAs($dealer->usuario)->getJson('/api/concesionaria/vehiculos')->assertOk();
    }

    public function test_approving_a_renewal_keeps_the_dealer_active_and_moves_the_period(): void
    {
        $admin = User::factory()->admin()->create();
        $dealer = Concesionaria::factory()->active()->create();
        $receipt = $this->pendingReceipt($dealer, [
            'estado' => Suscripcion::ESTADO_ACTIVA,
            'vigente_desde' => '2026-10-14',
            'vigente_hasta' => '2026-11-14',
        ], '2026-11-15', '2026-12-15');

        $this->approve($admin, $receipt)->assertOk();

        $suscripcion = $receipt->suscripcion->fresh();
        $this->assertSame('2026-11-15', $suscripcion->vigente_desde->toDateString());
        $this->assertSame('2026-12-15', $suscripcion->vigente_hasta->toDateString());
        $this->assertSame(Suscripcion::ESTADO_ACTIVA, $suscripcion->estado);
        $this->assertSame(Concesionaria::ESTADO_ACTIVA, $dealer->fresh()->estado_alta);

        Notification::assertSentTo($dealer->usuario, PaymentReceiptReviewedNotification::class, function ($notification, $channels, $notifiable) {
            $mail = $notification->toMail($notifiable);

            return ! in_array('Tu concesionaria ya está activa: ya podés gestionar tu inventario.', $mail->introLines, true);
        });
    }

    /**
     * @return array<string, array{array<string, mixed>, string}>
     */
    public static function invalidReasons(): array
    {
        return [
            'missing' => [[], 'Ingresá el motivo del rechazo.'],
            'blank' => [['motivo_rechazo' => '   '], 'Ingresá el motivo del rechazo.'],
            'too long' => [['motivo_rechazo' => str_repeat('a', 501)], 'El motivo no puede superar los 500 caracteres.'],
        ];
    }

    /**
     * TC-50: a rejection without a reason is refused and nothing changes.
     *
     * @param  array<string, mixed>  $body
     */
    #[DataProvider('invalidReasons')]
    public function test_tc50_rejecting_without_a_valid_reason_changes_nothing(array $body, string $message): void
    {
        $admin = User::factory()->admin()->create();
        $dealer = Concesionaria::factory()->create();
        $receipt = $this->pendingReceipt($dealer);

        $this->reject($admin, $receipt, $body)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['motivo_rechazo' => $message]);

        $receipt->refresh();
        $this->assertSame(ComprobantePago::ESTADO_PENDIENTE_REVISION, $receipt->estado);
        $this->assertNull($receipt->revisado_por_admin_id);
        $this->assertNull($receipt->fecha_revision);
        $this->assertSame(Concesionaria::ESTADO_PENDIENTE, $dealer->fresh()->estado_alta);
        Notification::assertNothingSent();
    }

    /**
     * TC-51: a rejection stores the reason and emails it to the dealer.
     */
    public function test_tc51_rejecting_with_a_reason_stores_it_and_notifies_the_dealer(): void
    {
        $admin = User::factory()->admin()->create();
        $dealer = Concesionaria::factory()->create();
        $receipt = $this->pendingReceipt($dealer);

        $this->reject($admin, $receipt, ['motivo_rechazo' => '  '.self::REASON.'  '])
            ->assertOk()
            ->assertJsonPath('estado', ComprobantePago::ESTADO_RECHAZADO)
            ->assertJsonPath('motivo_rechazo', self::REASON)
            ->assertJsonPath('concesionaria.estado_alta', Concesionaria::ESTADO_PENDIENTE);

        $receipt->refresh();
        $this->assertSame(ComprobantePago::ESTADO_RECHAZADO, $receipt->estado);
        $this->assertSame(self::REASON, $receipt->motivo_rechazo);
        $this->assertSame($admin->id, $receipt->revisado_por_admin_id);
        $this->assertNotNull($receipt->fecha_revision);

        $suscripcion = $receipt->suscripcion;
        $this->assertSame(Suscripcion::ESTADO_PENDIENTE, $suscripcion->estado);
        $this->assertNull($suscripcion->vigente_hasta);
        $this->assertSame(Concesionaria::ESTADO_PENDIENTE, $dealer->fresh()->estado_alta);

        Notification::assertSentTo($dealer->usuario, PaymentReceiptReviewedNotification::class, function ($notification, $channels, $notifiable) {
            $mail = $notification->toMail($notifiable);

            return $mail->subject === 'Rechazamos tu comprobante de pago'
                && in_array('Motivo: '.self::REASON, $mail->introLines, true);
        });
    }

    public function test_reason_of_exactly_500_characters_is_accepted(): void
    {
        $receipt = $this->pendingReceipt(Concesionaria::factory()->create());

        $this->reject(User::factory()->admin()->create(), $receipt, ['motivo_rechazo' => str_repeat('a', 500)])->assertOk();
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function decidedReceipts(): array
    {
        return [
            'approve an approved receipt' => ['aprobar', ComprobantePago::ESTADO_APROBADO],
            'reject an approved receipt' => ['rechazar', ComprobantePago::ESTADO_APROBADO],
            'approve a rejected receipt' => ['aprobar', ComprobantePago::ESTADO_RECHAZADO],
            'reject a rejected receipt' => ['rechazar', ComprobantePago::ESTADO_RECHAZADO],
        ];
    }

    #[DataProvider('decidedReceipts')]
    public function test_a_receipt_already_decided_cannot_be_decided_again(string $action, string $state): void
    {
        $dealer = Concesionaria::factory()->create();
        $receipt = $this->pendingReceipt($dealer);
        $receipt->forceFill(['estado' => $state])->save();

        $this->actingAs(User::factory()->admin()->create())
            ->postJson("/api/admin/comprobantes/{$receipt->id}/{$action}", ['motivo_rechazo' => self::REASON])
            ->assertConflict()
            ->assertExactJson(['message' => 'Este comprobante ya fue revisado.']);

        $this->assertSame($state, $receipt->fresh()->estado);
        $this->assertSame(Concesionaria::ESTADO_PENDIENTE, $dealer->fresh()->estado_alta);
        Notification::assertNothingSent();
    }

    public function test_the_dealer_can_upload_a_new_receipt_after_a_rejection(): void
    {
        config(['payments.transfer' => [
            'holder' => 'TD Autos SRL',
            'cuit' => '30-12345678-9',
            'bank' => 'Banco Nación',
            'cbu' => '0110000000000000000001',
            'alias' => 'tdautos.pagos',
            'monthly_amount' => '25000',
        ]]);

        $dealer = Concesionaria::factory()->create();
        $receipt = $this->pendingReceipt($dealer);
        $this->reject(User::factory()->admin()->create(), $receipt, ['motivo_rechazo' => self::REASON])->assertOk();

        $this->actingAs($dealer->usuario)
            ->postJson('/api/concesionaria/suscripcion/comprobantes', [
                'comprobante' => UploadedFile::fake()->create('nuevo.pdf', 50, 'application/pdf'),
            ])
            ->assertCreated()
            ->assertJsonPath('comprobante_pendiente.tipo', 'alta');

        $this->assertSame(2, $receipt->suscripcion->comprobantes()->count());
        $this->assertSame(ComprobantePago::ESTADO_PENDIENTE_REVISION, $receipt->suscripcion->comprobantes()->latest('id')->value('estado'));
    }
}
