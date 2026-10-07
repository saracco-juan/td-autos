<?php

namespace Tests\Unit\Diagnostico;

use App\Models\Diagnostico;
use App\Support\DiagnosticoOptions;
use PHPUnit\Framework\TestCase;

class DiagnosticoOptionsTest extends TestCase
{
    public function test_codes_are_mapped_to_stored_values(): void
    {
        $columns = DiagnosticoOptions::toColumns([
            'presupuesto' => '25m_40m',
            'uso_principal' => 'ruta',
            'pasajeros' => '5_mas',
            'kilometros_mensuales' => 'no_sabe',
            'transmision' => 'automatica',
            'prioridad' => 'seguridad',
            'carrocerias' => [1, 2],
        ]);

        $this->assertSame([
            'presupuesto_maximo' => 40000000,
            'uso_principal' => 'ruta',
            'pasajeros' => 5,
            'kilometros_mensuales' => 'no_sabe',
            'transmision_preferida' => 'automatica',
            'prioridad_comprador' => 'seguridad',
        ], $columns);
    }

    public function test_every_budget_and_passengers_code_round_trips(): void
    {
        foreach (['hasta_15m', '15m_25m', '25m_40m', 'mas_40m'] as $code) {
            $columns = DiagnosticoOptions::toColumns($this->answers(['presupuesto' => $code]));
            $answers = DiagnosticoOptions::toAnswers(new Diagnostico($columns), [1]);

            $this->assertSame($code, $answers['presupuesto']);
        }

        foreach (['1_2', '3_4', '5_mas'] as $code) {
            $columns = DiagnosticoOptions::toColumns($this->answers(['pasajeros' => $code]));
            $answers = DiagnosticoOptions::toAnswers(new Diagnostico($columns), [1]);

            $this->assertSame($code, $answers['pasajeros']);
        }
    }

    public function test_unlimited_budget_is_stored_as_null(): void
    {
        $columns = DiagnosticoOptions::toColumns($this->answers(['presupuesto' => 'mas_40m']));

        $this->assertNull($columns['presupuesto_maximo']);
    }

    public function test_decimal_strings_from_the_database_map_back_to_codes(): void
    {
        $diagnostico = new Diagnostico(DiagnosticoOptions::toColumns($this->answers()));
        $diagnostico->presupuesto_maximo = '15000000.00';

        $this->assertSame('hasta_15m', DiagnosticoOptions::toAnswers($diagnostico, [3])['presupuesto']);
    }

    public function test_answers_include_the_body_type_ids(): void
    {
        $answers = DiagnosticoOptions::toAnswers(new Diagnostico(DiagnosticoOptions::toColumns($this->answers())), [2, 5]);

        $this->assertSame([2, 5], $answers['carrocerias']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function answers(array $overrides = []): array
    {
        return $overrides + [
            'presupuesto' => 'hasta_15m',
            'uso_principal' => 'ciudad',
            'pasajeros' => '1_2',
            'kilometros_mensuales' => 'menos_500',
            'transmision' => 'manual',
            'prioridad' => 'consumo',
            'carrocerias' => [1],
        ];
    }
}
