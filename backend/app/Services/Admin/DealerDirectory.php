<?php

namespace App\Services\Admin;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Services\Subscription\SubscriptionLifecycle;
use Illuminate\Database\Eloquent\Builder;

/**
 * The dealer list of the administration area: every dealer with its receipt to review,
 * plus how many dealers are in each state.
 */
final class DealerDirectory
{
    /**
     * @return array{conteos: array<string, int>, concesionarias: list<array<string, mixed>>}
     */
    public function summary(): array
    {
        $dealers = Concesionaria::query()
            ->with('usuario:id,email')
            ->addSelect([
                'concesionaria.*',
                'comprobante_pendiente_id' => $this->latestReceiptId()->pendientes(),
                'ultimo_comprobante_id' => $this->latestReceiptId(),
                'ultimo_comprobante_estado' => $this->latestReceipt('comprobante_pago.estado'),
            ])
            ->orderBy('nombre')
            ->orderBy('id')
            ->get()
            // Stable sort: dealers waiting for a review first, alphabetical within each group.
            ->sortBy(fn (Concesionaria $dealer) => $dealer->comprobante_pendiente_id === null ? 1 : 0)
            ->values();

        return [
            'conteos' => [
                'activas' => $dealers->where('estado_alta', Concesionaria::ESTADO_ACTIVA)->count(),
                'pendientes' => $dealers->where('estado_alta', Concesionaria::ESTADO_PENDIENTE)->count(),
                'inactivas' => app(SubscriptionLifecycle::class)->inactiveCount(),
            ],
            'concesionarias' => $dealers->map(fn (Concesionaria $dealer) => [
                ...AdminPresenter::dealer($dealer),
                'comprobante_pendiente_id' => $dealer->comprobante_pendiente_id,
                'ultimo_comprobante_id' => $dealer->ultimo_comprobante_id,
                'ultimo_comprobante_estado' => $dealer->ultimo_comprobante_estado,
            ])->all(),
        ];
    }

    /**
     * @return Builder<ComprobantePago>
     */
    private function latestReceiptId(): Builder
    {
        return $this->latestReceipt('comprobante_pago.id');
    }

    /**
     * One column of the dealer's most recent receipt, in any state.
     *
     * @return Builder<ComprobantePago>
     */
    private function latestReceipt(string $column): Builder
    {
        return ComprobantePago::query()
            ->select($column)
            ->join('suscripcion', 'suscripcion.id', '=', 'comprobante_pago.suscripcion_id')
            ->whereColumn('suscripcion.concesionaria_id', 'concesionaria.id')
            ->orderByDesc('comprobante_pago.id')
            ->limit(1);
    }
}
