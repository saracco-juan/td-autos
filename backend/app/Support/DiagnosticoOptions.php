<?php

namespace App\Support;

use App\Models\Diagnostico;

/**
 * Option codes of the needs questionnaire and their stored values.
 * The API speaks codes only; this is the single place that knows how they are persisted.
 */
final class DiagnosticoOptions
{
    /** Code => presupuesto_maximo (upper limit, null means no cap). */
    public const PRESUPUESTO = [
        'hasta_15m' => 15000000,
        '15m_25m' => 25000000,
        '25m_40m' => 40000000,
        'mas_40m' => null,
    ];

    /** Code => seats needed. */
    public const PASAJEROS = [
        '1_2' => 2,
        '3_4' => 4,
        '5_mas' => 5,
    ];

    public const USO_PRINCIPAL = ['ciudad', 'ruta', 'mixto', 'trabajo'];

    public const KILOMETROS_MENSUALES = ['menos_500', '500_1500', '1500_3000', 'mas_3000', 'no_sabe'];

    public const TRANSMISION = ['manual', 'automatica', 'indiferente'];

    public const PRIORIDAD = ['consumo', 'seguridad', 'mantenimiento', 'reventa'];

    /**
     * Validated answers (codes) to the diagnostico columns.
     *
     * @param  array<string, mixed>  $answers
     * @return array<string, mixed>
     */
    public static function toColumns(array $answers): array
    {
        return [
            'presupuesto_maximo' => self::PRESUPUESTO[$answers['presupuesto']],
            'uso_principal' => $answers['uso_principal'],
            'pasajeros' => self::PASAJEROS[$answers['pasajeros']],
            'kilometros_mensuales' => $answers['kilometros_mensuales'],
            'transmision_preferida' => $answers['transmision'],
            'prioridad_comprador' => $answers['prioridad'],
        ];
    }

    /**
     * A stored diagnostico back to the answers (codes) the client sees.
     *
     * @param  list<int>  $carroceriaIds
     * @return array<string, mixed>
     */
    public static function toAnswers(Diagnostico $diagnostico, array $carroceriaIds): array
    {
        $budget = $diagnostico->presupuesto_maximo;

        return [
            'presupuesto' => array_search($budget === null ? null : (int) round((float) $budget), self::PRESUPUESTO, true),
            'uso_principal' => $diagnostico->uso_principal,
            'pasajeros' => array_search((int) $diagnostico->pasajeros, self::PASAJEROS, true),
            'kilometros_mensuales' => $diagnostico->kilometros_mensuales,
            'transmision' => $diagnostico->transmision_preferida,
            'prioridad' => $diagnostico->prioridad_comprador,
            'carrocerias' => $carroceriaIds,
        ];
    }
}
