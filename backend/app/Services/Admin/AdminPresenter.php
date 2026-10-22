<?php

namespace App\Services\Admin;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Services\Subscription\SubscriptionLifecycle;
use App\Support\PaymentReceipts;
use App\Support\SuscripcionPresenter;

/**
 * Shapes the dealers and payment receipts the administrator reviews (RF19, CU-17).
 */
final class AdminPresenter
{
    /**
     * @return array<string, mixed>
     */
    public static function dealer(Concesionaria $dealer): array
    {
        return [
            'id' => $dealer->id,
            'nombre' => $dealer->nombre,
            'localidad' => $dealer->localidad,
            'provincia' => $dealer->provincia,
            'estado_alta' => $dealer->estado_alta,
            'contacto' => [
                'email' => $dealer->usuario?->email,
                'telefono' => $dealer->telefono_responsable,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function receipt(ComprobantePago $receipt): array
    {
        return [
            'id' => $receipt->id,
            'estado' => $receipt->estado,
            'tipo' => $receipt->esRenovacion() ? SuscripcionPresenter::TIPO_RENOVACION : SuscripcionPresenter::TIPO_ALTA,
            'periodo_desde' => $receipt->periodo_desde->toDateString(),
            'periodo_hasta' => $receipt->periodo_hasta->toDateString(),
            'enviado_en' => $receipt->fecha_de_pago?->toIso8601String(),
            'nombre_archivo' => PaymentReceipts::fileName($receipt->archivo_url),
            'archivo_url' => route('admin.comprobantes.archivo', $receipt),
            'motivo_rechazo' => $receipt->motivo_rechazo,
            'fecha_revision' => $receipt->fecha_revision?->toIso8601String(),
            'concesionaria' => [
                ...self::dealer($receipt->suscripcion->concesionaria),
                // Effective state evaluated from the dates, as in the dealer directory.
                'suscripcion_estado' => app(SubscriptionLifecycle::class)->state($receipt->suscripcion),
            ],
        ];
    }
}
