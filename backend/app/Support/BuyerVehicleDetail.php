<?php

namespace App\Support;

use App\Models\Vehiculo;

/** Buyer-only projection: never reuse the inventory presenter, which includes plate data. */
final class BuyerVehicleDetail
{
    public static function present(Vehiculo $vehicle): array
    {
        $facts = $vehicle->only(array_merge([
            'id', 'marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio', 'moneda',
            'transmision', 'combustible', 'ubicacion', 'descripcion', 'plazas', 'motor',
            'turbo', 'potencia', 'potencia_unidad', 'consumo_urbano', 'consumo_ruta',
        ], array_keys(VehiculoFields::EQUIPMENT_FIELDS)));
        foreach (['precio', 'consumo_urbano', 'consumo_ruta'] as $field) {
            $facts[$field] = $facts[$field] === null ? null : (float) $facts[$field];
        }

        return [
            'vehicle' => $facts + [
                'carroceria' => $vehicle->tipoCarroceria?->nombre,
                'fotos' => $vehicle->fotos->map(fn ($photo) => [
                    'id' => $photo->id,
                    'url' => VehiculoFotos::url($photo->ubicacion_archivo),
                    'orden' => $photo->orden,
                ])->all(),
            ],
            'dealer' => $vehicle->propiedad->concesionaria->only(['id', 'nombre', 'provincia']),
        ];
    }
}
