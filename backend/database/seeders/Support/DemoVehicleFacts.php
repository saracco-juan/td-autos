<?php

namespace Database\Seeders\Support;

use App\Support\VehiculoFields;

/**
 * Explicit synthetic profiles for local testing, never specifications inferred from a real model.
 */
final class DemoVehicleFacts
{
    public const NOTICE = 'Datos sintéticos para pruebas; no representan la ficha técnica ni una oferta real.';

    /** @return array<string, mixed> */
    public static function profile(int $index, string $fuel): array
    {
        $profile = $index % 3;
        $equipment = array_fill_keys(array_keys(VehiculoFields::EQUIPMENT_FIELDS), $profile === 1);
        if ($profile === 0) {
            foreach (['frenos_abs', 'airbags_frontales', 'recordatorio_cinturon', 'aire_acondicionado',
                'android_auto_apple_carplay', 'sensores_estacionamiento'] as $field) {
                $equipment[$field] = true;
            }
        }
        $needsConsumption = in_array($fuel, ['nafta', 'diesel'], true);

        return [
            'plazas' => [5, 5, 7][$profile],
            'motor' => ['Motor de prueba 1.6', 'Motor de prueba 2.0', 'Motor de prueba 1.4'][$profile],
            'turbo' => $profile === 1,
            'potencia' => [100, 150, 90][$profile],
            'potencia_unidad' => 'CV',
            'consumo_urbano' => $needsConsumption ? [8.5, 10, 7.5][$profile] : null,
            'consumo_ruta' => $needsConsumption ? [6.2, 7, 5.5][$profile] : null,
            ...$equipment,
        ];
    }
}
