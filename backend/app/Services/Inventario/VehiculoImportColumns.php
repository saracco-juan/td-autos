<?php

namespace App\Services\Inventario;

use App\Support\VehiculoFields;

final class VehiculoImportColumns
{
    private const BASE = [
        'patente', 'marca', 'modelo', 'version', 'anio', 'kilometraje', 'precio',
        'transmision', 'combustible', 'carroceria', 'ubicacion', 'descripcion', 'fotos',
        'moneda', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad',
        'consumo_urbano', 'consumo_ruta',
    ];

    public const MAX_ROWS = 500;

    public static function headers(): array
    {
        return [...self::BASE, ...array_keys(VehiculoFields::EQUIPMENT_FIELDS)];
    }
}
