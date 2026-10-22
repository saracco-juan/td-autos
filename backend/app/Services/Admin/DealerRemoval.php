<?php

namespace App\Services\Admin;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Models\User;
use App\Models\Vehiculo;
use App\Services\Inventario\VehiculoDestroyer;
use App\Services\Subscription\SubscriptionLifecycle;
use App\Support\PaymentReceipts;
use App\Support\VehiculoFotos;
use Illuminate\Support\Facades\DB;

/**
 * Permanently deletes a dealer with its account, vehicles, leads, subscription and receipts (RF34,
 * RF35, CU-26). A dealer whose subscription is valid or in grace is never deleted. There are no
 * cascades, so children go first; the stored files go only after the rows are gone.
 */
final class DealerRemoval
{
    public function __construct(
        private readonly SubscriptionLifecycle $lifecycle,
        private readonly VehiculoDestroyer $destroyer,
    ) {}

    /**
     * Whether the dealer can be deleted now: it has no subscription, or it is pending or inactive.
     */
    public function allows(Concesionaria $dealer): bool
    {
        $subscription = $dealer->suscripcion()->first();

        return $subscription === null || $this->isRemovable($subscription);
    }

    /**
     * @throws DealerHasCurrentSubscriptionException
     */
    public function remove(Concesionaria $dealer): void
    {
        [$photos, $receipts] = DB::transaction(function () use ($dealer): array {
            // Re-checked under the lock: a receipt may have been approved since the screen loaded.
            $subscription = Suscripcion::query()->where('concesionaria_id', $dealer->id)->lockForUpdate()->first();

            if ($subscription !== null && ! $this->isRemovable($subscription)) {
                throw new DealerHasCurrentSubscriptionException;
            }

            $photos = $this->deleteVehicles($dealer);
            $receipts = $subscription ? $this->deleteSubscription($subscription) : [];
            $user = $dealer->usuario;
            $dealer->delete();

            if ($user !== null) {
                $this->deleteAccount($user);
            }

            return [$photos, $receipts];
        });

        VehiculoFotos::forget($photos);
        array_walk($receipts, fn (string $path) => PaymentReceipts::forget($path));
    }

    private function isRemovable(Suscripcion $subscription): bool
    {
        return ! $this->lifecycle->allowsInventory($subscription);
    }

    /**
     * @return list<string> Photo paths to forget after commit.
     */
    private function deleteVehicles(Concesionaria $dealer): array
    {
        $ids = DB::table('vehiculo_concesionaria')->where('concesionaria_id', $dealer->id)->pluck('vehiculo_id');

        return Vehiculo::query()->whereKey($ids)->get()
            ->flatMap(fn (Vehiculo $vehiculo): array => $this->destroyer->deleteRows($vehiculo))
            ->values()
            ->all();
    }

    /**
     * @return list<string> Receipt paths to forget after commit.
     */
    private function deleteSubscription(Suscripcion $subscription): array
    {
        $receipts = DB::table('comprobante_pago')->where('suscripcion_id', $subscription->id);
        $paths = (clone $receipts)->pluck('archivo_url')->all();
        $receipts->delete();
        $subscription->delete();

        return $paths;
    }

    /**
     * Delete the dealer's account with every row that points to it: what it may have created on the
     * buyer side, its API tokens, sessions and pending password resets.
     */
    private function deleteAccount(User $user): void
    {
        $diagnoses = DB::table('diagnostico')->where('usuario_id', $user->id);
        DB::table('diagnostico_carroceria')->whereIn('diagnostico_id', (clone $diagnoses)->select('id'))->delete();
        DB::table('recomendacion')->whereIn('diagnostico_id', (clone $diagnoses)->select('id'))->delete();
        $diagnoses->delete();

        $inspections = DB::table('checklist_inspeccion')->where('usuario_id', $user->id);
        DB::table('item_inspeccion_completado')->whereIn('checklist_id', (clone $inspections)->select('id'))->delete();
        $inspections->delete();

        $transfers = DB::table('checklist_transferencia')->where('usuario_id', $user->id);
        DB::table('etapa_transferencia_completada')->whereIn('seguimiento_id', (clone $transfers)->select('id'))->delete();
        $transfers->delete();

        DB::table('favorito')->where('usuario_id', $user->id)->delete();
        DB::table('lead')->where('comprador_usuario_id', $user->id)->delete();
        DB::table('comprobante_pago')->where('revisado_por_admin_id', $user->id)->update(['revisado_por_admin_id' => null]);
        $user->tokens()->delete();
        DB::table('sessions')->where('user_id', $user->id)->delete();
        DB::table('password_reset_tokens')->where('email', $user->email)->delete();
        $user->delete();
    }
}
