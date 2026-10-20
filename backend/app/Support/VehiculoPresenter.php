<?php

namespace App\Support;

use App\Models\Vehiculo;

/**
 * JSON shape of a dealer vehicle, shared by every inventory endpoint.
 */
final class VehiculoPresenter
{
    /**
     * Relations the shape reads; eager load them on lists.
     *
     * @var list<string>
     */
    public const RELATIONS = ['propiedad', 'tipoCarroceria', 'fotos'];

    /**
     * @return array<string, mixed>
     */
    public static function present(Vehiculo $vehiculo): array
    {
        $vehiculo->loadMissing(self::RELATIONS);
        $body = $vehiculo->tipoCarroceria;

        return [
            'id' => $vehiculo->id,
            'patente' => $vehiculo->propiedad?->patente_normalizada,
            'marca' => $vehiculo->marca,
            'modelo' => $vehiculo->modelo,
            'version' => $vehiculo->version,
            'anio' => $vehiculo->anio,
            'kilometraje' => $vehiculo->kilometraje,
            'precio' => $vehiculo->precio + 0,
            'moneda' => $vehiculo->moneda,
            'transmision' => $vehiculo->transmision,
            'combustible' => $vehiculo->combustible,
            'plazas' => $vehiculo->plazas,
            'motor' => $vehiculo->motor,
            'turbo' => $vehiculo->turbo,
            'potencia' => $vehiculo->potencia,
            'potencia_unidad' => $vehiculo->potencia_unidad,
            'consumo_urbano' => $vehiculo->consumo_urbano === null ? null : $vehiculo->consumo_urbano + 0,
            'consumo_ruta' => $vehiculo->consumo_ruta === null ? null : $vehiculo->consumo_ruta + 0,
            ...$vehiculo->only(array_keys(VehiculoFields::EQUIPMENT_FIELDS)),
            'carroceria' => $body ? ['id' => $body->id, 'nombre' => $body->nombre] : null,
            'ubicacion' => $vehiculo->ubicacion,
            'descripcion' => $vehiculo->descripcion,
            'fotos' => $vehiculo->fotos->map(fn ($foto) => [
                'id' => $foto->id,
                'url' => VehiculoFotos::url($foto->ubicacion_archivo),
                'orden' => $foto->orden,
            ])->all(),
        ];
    }
}
