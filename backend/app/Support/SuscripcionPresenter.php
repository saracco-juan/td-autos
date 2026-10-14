<?php

namespace App\Support;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;

/**
 * Builds the subscription summary the dealer sees: account state, transfer data, pending receipt
 * and the outcome of the latest receipt (so a rejection and its reason reach the dealer).
 */
final class SuscripcionPresenter
{
    public const TIPO_ALTA = 'alta';

    public const TIPO_RENOVACION = 'renovacion';

    /**
     * @return array<string, mixed>
     */
    public static function present(Concesionaria $dealer): array
    {
        $suscripcion = $dealer->suscripcion()->first();
        $receipt = $suscripcion?->comprobantes()->pendientes()->latest('id')->first();
        $latest = $suscripcion?->comprobantes()->latest('id')->first();

        return [
            'estado_alta' => $dealer->estado_alta,
            'tipo_pago' => $dealer->estado_alta === Concesionaria::ESTADO_ACTIVA ? self::TIPO_RENOVACION : self::TIPO_ALTA,
            'transferencia' => self::transfer(),
            'comprobante_pendiente' => $receipt ? self::receipt($receipt, $suscripcion) : null,
            'ultimo_comprobante' => $latest ? self::outcome($latest) : null,
        ];
    }

    /**
     * The kind of payment a subscription is asking for: the first activation until it was
     * ever valid (no `vigente_hasta`), a monthly renewal afterwards. There is no kind column.
     */
    public static function tipo(?Suscripcion $suscripcion): string
    {
        return $suscripcion?->vigente_hasta === null ? self::TIPO_ALTA : self::TIPO_RENOVACION;
    }

    /**
     * @return array<string, string>|null
     */
    private static function transfer(): ?array
    {
        $data = TransferData::fromConfig();

        return $data === null ? null : [
            'titular' => $data['holder'],
            'cuit' => $data['cuit'],
            'banco' => $data['bank'],
            'cbu' => $data['cbu'],
            'alias' => $data['alias'],
            'monto_mensual' => $data['monthly_amount'],
        ];
    }

    /**
     * @return array{id: int, estado: string, motivo_rechazo: ?string, fecha_revision: ?string}
     */
    private static function outcome(ComprobantePago $receipt): array
    {
        return [
            'id' => $receipt->id,
            'estado' => $receipt->estado,
            'motivo_rechazo' => $receipt->motivo_rechazo,
            'fecha_revision' => $receipt->fecha_revision?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function receipt(ComprobantePago $receipt, Suscripcion $suscripcion): array
    {
        return [
            'id' => $receipt->id,
            'nombre_archivo' => PaymentReceipts::fileName($receipt->archivo_url),
            'enviado_en' => $receipt->fecha_de_pago->toIso8601String(),
            'tipo' => self::tipo($suscripcion),
            'periodo_desde' => $receipt->periodo_desde->toDateString(),
            'periodo_hasta' => $receipt->periodo_hasta->toDateString(),
        ];
    }
}
