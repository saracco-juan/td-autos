<?php

namespace App\Services\Subscription;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Notifications\PaymentReceiptReviewedNotification;
use Illuminate\Support\Facades\DB;

/**
 * An administrator's decision on a payment receipt (RF19, RF33, CU-17). Approving sets the
 * subscription validity to the paid period and activates a dealer on its first payment;
 * rejecting keeps everything else as it was. The dealer is emailed once the decision is saved.
 */
final class ReceiptReview
{
    /**
     * @throws ReceiptAlreadyReviewedException
     */
    public function approve(ComprobantePago $receipt, User $admin): ComprobantePago
    {
        $activated = DB::transaction(function () use ($receipt, $admin): bool {
            $this->decide($receipt, $admin, ComprobantePago::ESTADO_APROBADO);

            $receipt->suscripcion->forceFill([
                'estado' => Suscripcion::ESTADO_ACTIVA,
                'vigente_desde' => $receipt->periodo_desde,
                'vigente_hasta' => $receipt->periodo_hasta,
            ])->save();

            $dealer = $receipt->suscripcion->concesionaria;

            if ($dealer->estado_alta !== Concesionaria::ESTADO_PENDIENTE) {
                return false;
            }

            // The first approved payment is what activates a dealer (TC-49).
            $dealer->forceFill(['estado_alta' => Concesionaria::ESTADO_ACTIVA])->save();

            return true;
        });

        $this->notifyDealer($receipt, $activated);

        return $receipt;
    }

    /**
     * @throws ReceiptAlreadyReviewedException
     */
    public function reject(ComprobantePago $receipt, User $admin, string $reason): ComprobantePago
    {
        DB::transaction(fn () => $this->decide($receipt, $admin, ComprobantePago::ESTADO_RECHAZADO, $reason));

        $this->notifyDealer($receipt, false);

        return $receipt;
    }

    /**
     * Record the decision on a receipt that is still pending, locking it so two
     * administrators cannot decide the same receipt at once.
     */
    private function decide(ComprobantePago $receipt, User $admin, string $state, ?string $reason = null): void
    {
        $current = ComprobantePago::query()->lockForUpdate()->findOrFail($receipt->id);

        if (! $current->estaPendiente()) {
            throw new ReceiptAlreadyReviewedException;
        }

        $receipt->forceFill([
            'estado' => $state,
            'revisado_por_admin_id' => $admin->id,
            'fecha_revision' => now(),
            'motivo_rechazo' => $reason,
        ])->save();
    }

    private function notifyDealer(ComprobantePago $receipt, bool $activated): void
    {
        $user = $receipt->suscripcion->concesionaria->usuario;

        if ($user === null) {
            return;
        }

        // The decision is already saved: a mail failure must not turn it into an error.
        try {
            $user->notify(new PaymentReceiptReviewedNotification($receipt, $activated));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
