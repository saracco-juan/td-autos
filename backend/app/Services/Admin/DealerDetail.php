<?php

namespace App\Services\Admin;

use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Support\SuscripcionPresenter;
use Illuminate\Support\Facades\DB;

/**
 * One dealer as the administrator sees it: all its data, its subscription and its receipts (RF32, CU-25).
 */
final class DealerDetail
{
    /**
     * @return array<string, mixed>
     */
    public function show(Concesionaria $dealer): array
    {
        $dealer->load('usuario');
        $subscription = $dealer->suscripcion()->first();

        return [
            'id' => $dealer->id,
            'nombre' => $dealer->nombre,
            'responsable_nombre' => $dealer->usuario?->name,
            'responsable_apellido' => $dealer->usuario?->apellido,
            'responsable_dni' => $dealer->responsable_dni,
            'telefono_responsable' => $dealer->telefono_responsable,
            'telefono_publico' => $dealer->telefono_publico,
            'email' => $dealer->usuario?->email,
            'direccion' => $dealer->direccion,
            'localidad' => $dealer->localidad,
            'provincia' => $dealer->provincia,
            'estado_alta' => $dealer->estado_alta,
            'suscripcion' => $subscription ? [
                'estado' => $subscription->estado,
                'vigente_desde' => $subscription->vigente_desde?->toDateString(),
                'vigente_hasta' => $subscription->vigente_hasta?->toDateString(),
            ] : null,
            'comprobantes' => $this->receipts($subscription),
        ];
    }

    /**
     * Updates the dealer and its responsible user together. Never touches the password, the role
     * or the registration state.
     *
     * @param  array<string, string>  $data  Validated by UpdateDealerRequest.
     */
    public function update(Concesionaria $dealer, array $data): void
    {
        DB::transaction(function () use ($dealer, $data) {
            $dealer->update([
                'nombre' => $data['nombre'],
                'responsable_dni' => $data['responsable_dni'],
                'telefono_publico' => $data['telefono_publico'],
                'telefono_responsable' => $data['telefono_responsable'],
                'direccion' => $data['direccion'],
                'localidad' => $data['localidad'],
                'provincia' => $data['provincia'],
            ]);

            $dealer->usuario->update([
                'name' => $data['responsable_nombre'],
                'apellido' => $data['responsable_apellido'],
                'email' => $data['email'],
            ]);
        });
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function receipts(?Suscripcion $subscription): array
    {
        if ($subscription === null) {
            return [];
        }

        return $subscription->comprobantes()->orderByDesc('id')->get()
            ->map(fn (ComprobantePago $receipt) => [
                'id' => $receipt->id,
                'tipo' => $receipt->esRenovacion() ? SuscripcionPresenter::TIPO_RENOVACION : SuscripcionPresenter::TIPO_ALTA,
                'estado' => $receipt->estado,
                'periodo_desde' => $receipt->periodo_desde->toDateString(),
                'periodo_hasta' => $receipt->periodo_hasta->toDateString(),
                'enviado_en' => $receipt->fecha_de_pago?->toIso8601String(),
                'motivo_rechazo' => $receipt->motivo_rechazo,
                'fecha_revision' => $receipt->fecha_revision?->toIso8601String(),
            ])
            ->all();
    }
}
