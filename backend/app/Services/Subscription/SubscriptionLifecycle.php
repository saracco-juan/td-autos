<?php

namespace App\Services\Subscription;

use App\Models\Suscripcion;
use App\Models\VehiculoConcesionaria;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Validity rules of a dealer subscription (RF17, RF20, RF21, RF26). `vigente_hasta` is inclusive,
 * the three following days are grace and from the fourth day the subscription is inactive. The
 * state is always derived from dates, so a gate can use it before the scheduled command has run.
 */
final class SubscriptionLifecycle
{
    public const STATE_PENDING = 'pendiente';

    public const STATE_ACTIVE = 'activa';

    public const STATE_GRACE = 'gracia';

    public const STATE_INACTIVE = 'inactiva';

    public const GRACE_DAYS = 3;

    public const RETENTION_DAYS = 30;

    /**
     * Last day with full access after the validity ended; null while there is no validity.
     */
    public function graceUntil(Suscripcion $subscription): ?CarbonImmutable
    {
        if ($subscription->vigente_hasta === null) {
            return null;
        }

        return CarbonImmutable::parse($subscription->vigente_hasta)->startOfDay()->addDays(self::GRACE_DAYS);
    }

    /**
     * The state that applies at the given moment (now by default).
     */
    public function state(Suscripcion $subscription, ?CarbonInterface $at = null): string
    {
        if ($subscription->estado === Suscripcion::ESTADO_INACTIVA) {
            return self::STATE_INACTIVE;
        }

        // A subscription that was never approved has no validity to expire.
        if ($subscription->estado === Suscripcion::ESTADO_PENDIENTE || $subscription->vigente_hasta === null) {
            return self::STATE_PENDING;
        }

        $today = CarbonImmutable::instance($at ?? now())->startOfDay();

        return match (true) {
            $today->lte($subscription->vigente_hasta) => self::STATE_ACTIVE,
            $today->lte($this->graceUntil($subscription)) => self::STATE_GRACE,
            default => self::STATE_INACTIVE,
        };
    }

    /**
     * Inventory management stays open while the subscription is valid or in grace (RF21).
     */
    public function allowsInventory(Suscripcion $subscription, ?CarbonInterface $at = null): bool
    {
        return in_array($this->state($subscription, $at), [self::STATE_ACTIVE, self::STATE_GRACE], true);
    }

    /**
     * Inactivate every approved subscription whose grace period is over; returns how many changed.
     */
    public function process(): int
    {
        $lastGraceDay = now()->startOfDay()->subDays(self::GRACE_DAYS + 1);

        $ids = Suscripcion::query()
            ->where('estado', Suscripcion::ESTADO_ACTIVA)
            ->whereDate('vigente_hasta', '<=', $lastGraceDay->toDateString())
            ->pluck('id');

        return $ids->filter(fn (int $id): bool => $this->inactivate($id))->count();
    }

    private function inactivate(int $id): bool
    {
        return DB::transaction(function () use ($id): bool {
            $subscription = Suscripcion::query()->lockForUpdate()->find($id);

            // Re-checked under the lock: a renewal may have been approved since the query.
            if ($subscription?->estado !== Suscripcion::ESTADO_ACTIVA || $this->state($subscription) !== self::STATE_INACTIVE) {
                return false;
            }

            // Inactive from the start of the day after grace; vehicles are kept 30 days from then.
            $graceUntil = $this->graceUntil($subscription);
            $inactiveSince = $graceUntil->addDay();
            $retentionUntil = $inactiveSince->addDays(self::RETENTION_DAYS);

            $subscription->forceFill([
                'estado' => Suscripcion::ESTADO_INACTIVA,
                'gracia_hasta' => $graceUntil->toDateString(),
                'inactiva_desde' => $inactiveSince->toDateString(),
                'retencion_hasta' => $retentionUntil->toDateString(),
            ])->save();

            // Vehicles already hidden keep their own dates.
            VehiculoConcesionaria::query()
                ->where('concesionaria_id', $subscription->concesionaria_id)
                ->where('visible', true)
                ->update([
                    'visible' => false,
                    'ocultado_en' => now(),
                    'eliminar_desde' => $retentionUntil,
                ]);

            return true;
        });
    }
}
