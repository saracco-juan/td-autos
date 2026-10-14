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
