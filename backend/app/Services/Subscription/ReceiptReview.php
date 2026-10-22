<?php

namespace App\Services\Subscription;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\VehiculoConcesionaria;
use App\Notifications\PaymentReceiptReviewedNotification;
use App\Services\Inventario\VehiculoDestroyer;
use App\Support\VehiculoFotos;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * An administrator's decision on a payment receipt (RF19, RF33, CU-17). Approving sets the
 * subscription validity to the paid period and activates a dealer on its first payment;
 * rejecting keeps everything else as it was. The dealer is emailed once the decision is saved.
 */
final class ReceiptReview
{
    public function __construct(
        private readonly SubscriptionLifecycle $lifecycle,
        private readonly VehiculoDestroyer $destroyer,
    ) {}

    /**
     * @throws ReceiptAlreadyReviewedException
     */
    public function approve(ComprobantePago $receipt, User $admin): ComprobantePago
    {
        $paths = [];

        $activated = DB::transaction(function () use ($receipt, $admin, &$paths): bool {
            $this->decide($receipt, $admin, ComprobantePago::ESTADO_APROBADO);

            $paths = $this->applyPeriod($receipt);

            $dealer = $receipt->suscripcion->concesionaria;

            if ($dealer->estado_alta !== Concesionaria::ESTADO_PENDIENTE) {
                return false;
            }

            // The first approved payment is what activates a dealer (TC-49).
            $dealer->forceFill(['estado_alta' => Concesionaria::ESTADO_ACTIVA])->save();

            return true;
        });

        // The photo files of vehicles deleted by the approval go once the rows are gone for good.
        VehiculoFotos::forget($paths);

        $this->notifyDealer($receipt, $activated);

        return $receipt;
    }

    /**
     * Set the validity the approval grants and make the receipt record the period actually applied.
     * The first payment keeps the receipt period; a renewal continues from the end of the current
     * validity (valid or in grace, no free days and never backwards), or starts today once the
     * subscription is inactive. Reactivating an inactive subscription also settles its retained
     * vehicles (RF26, RF27): the ones whose retention already ended are deleted, the rest are published
     * again. Returns the photo paths to delete from the disk once the transaction commits.
     *
     * \return list<string>
     */
    private function applyPeriod(ComprobantePago $receipt): array
    {
        $subscription = $receipt->suscripcion;
        $from = $receipt->periodo_desde;
        $to = $receipt->periodo_hasta;
        $wasInactive = false;

        if ($subscription->vigente_hasta !== null) {
            $wasInactive = $this->lifecycle->state($subscription) === SubscriptionLifecycle::STATE_INACTIVE;
            $from = $wasInactive ? Carbon::today() : $subscription->vigente_hasta->copy()->addDay();
            // Same month arithmetic as the receipt upload (SuscripcionController::createReceipt).
            $to = $from->copy()->addMonth();

            $receipt->forceFill(['periodo_desde' => $from, 'periodo_hasta' => $to])->save();
        }

        $subscription->forceFill([
            'estado' => Suscripcion::ESTADO_ACTIVA,
            'vigente_desde' => $from,
            'vigente_hasta' => $to,
            'gracia_hasta' => null,
            'inactiva_desde' => null,
            'retencion_hasta' => null,
        ])->save();

        return $wasInactive ? $this->settleRetainedVehicles($subscription->concesionaria_id) : [];
    }

    /**
     * Delete the dealer's hidden vehicles whose retention ended before this approval and publish
     * the others again. Returns the photo paths of the deleted ones.
     *
     * \return list<string>
     */
    private function settleRetainedVehicles(int $dealerId): array
    {
        $hidden = VehiculoConcesionaria::query()->where('concesionaria_id', $dealerId)->where('visible', false);
        $paths = [];

        foreach ((clone $hidden)->where('eliminar_desde', '<=', now())->with('vehiculo')->get() as $ownership) {
            $paths = [...$paths, ...$this->destroyer->deleteRows($ownership->vehiculo)];
        }

        $hidden->update(['visible' => true, 'ocultado_en' => null, 'eliminar_desde' => null]);

        return $paths;
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
