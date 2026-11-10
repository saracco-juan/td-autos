<?php

namespace Tests\Unit\Support;

use App\Support\VehiculoFields;
use App\Support\VehiculoMatchingFacts;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * The pure check must give the same verdict as the publication rules the ranker used to run
 * through the Laravel validator for every vehicle on every request.
 */
class VehiculoMatchingFactsEquivalenceTest extends TestCase
{
    private const YEAR = 2026;

    /** Verdict of the validator exactly as DealershipRanker::hasValidFacts() built it before. */
    private function validatorVerdict(array $attributes, int $year): bool
    {
        $rules = VehiculoFields::rules(includeMatchingFacts: true);
        unset($rules['patente']);
        $rules['carroceria_id'] = ['required', 'integer', 'min:1'];
        $rules['anio'] = ['required', 'integer', 'between:1950,'.($year + 1)];

        return Validator::make($attributes, $rules)->passes();
    }

    /** @return array<string, mixed> */
    private function baseRow(): array
    {
        return array_replace(array_fill_keys(array_keys(VehiculoFields::EQUIPMENT_FIELDS), true), [
            'carroceria_id' => 1, 'marca' => 'Toyota', 'modelo' => 'Corolla', 'version' => 'XEI',
            'anio' => 2021, 'kilometraje' => 45000, 'precio' => '25000000.00', 'moneda' => 'ARS',
            'combustible' => 'nafta', 'transmision' => 'manual', 'plazas' => 5,
            'motor' => '1.6', 'turbo' => false, 'potencia' => 110, 'potencia_unidad' => 'CV',
            'consumo_urbano' => '6.00', 'consumo_ruta' => '5.00', 'ubicacion' => 'Buenos Aires',
            'descripcion' => 'Single owner',
            // Columns the rules do not look at must not matter.
            'id' => 9, 'origen' => 'concesionaria', 'patente' => 'not a plate',
        ]);
    }

    /** @return list<mixed> */
    private function commonEdges(): array
    {
        return [
            null, '', '  ', "\t", 0, -1, 1, 2, '12', '12.0', 12.5, 'abc', true, false, '1', '0', 't', 'true',
            [], [1], 1.0, 0.0, '1e3', ' 12 ', '+5', '-0', '1.', '.5', '0x1A', "12\n", 'ñandú',
            str_repeat('a', 100), str_repeat('a', 101), str_repeat('á', 100), str_repeat('á', 101),
            PHP_INT_MAX, '99999999999999999999', 1.5e3,
        ];
    }

    /** @return array<string, list<mixed>> */
    private function fieldEdges(): array
    {
        $enum = fn (array $values) => [...$values, ...array_map('strtoupper', $values), ...array_map('ucfirst', $values),
            ' '.$values[0], $values[0].' ', 'otro'];
        $consumo = ['0.00', '0.01', '0.001', '0.005', '1.234', '9999.99', '9999.991', '9999.98', '10000', '10000.00', 6, 6.5,
            6.55, 0.1, 5.0, '5.0', '5.', '.5', '.', '-5.00', '+5.00', '1e1', '1E1', "5.00\n", ' 5.00', '5.00 ', '00005.50',
            '99999999999999999999999.99', 9999.99, 10000.0, '0', '0.0', 0, -0.01];
        $text = [str_repeat('a', 99), str_repeat('a', 100), str_repeat('a', 101), '  x  ', 123, 12.5, '123'];

        return [
            'carroceria_id' => [0, 1, 2, '1', '0', '-1', 1.0, '1.0', true, PHP_INT_MAX, 32768],
            'anio' => [1949, 1950, 1951, self::YEAR, self::YEAR + 1, self::YEAR + 2, '1949', '1950', '2027', '2028', 2027.0, 2027.5, ' 2020', '2020 '],
            'kilometraje' => [-1, 0, 1, 2000000, 2000001, '2000000', '2000001', 1999999.0, 2000000.5],
            'precio' => [0, 0.99, 1, '1', '0.99', '1.00', 25000000, 25000000.5, '9999999999.99', '9999999999.990', '9999999999.991',
                '10000000000', 9999999999.99, 10000000000.0, '1e3', '1e10', ' 100 ', '1,5', -5, '25000000.00'],
            'moneda' => $enum(['ARS', 'USD']),
            'transmision' => $enum(['manual', 'automatica']),
            'combustible' => $enum(['nafta', 'diesel', 'gnc', 'hibrido', 'electrico']),
            'potencia_unidad' => $enum(['CV', 'HP', 'kW']),
            'plazas' => [0, 1, 2, 32767, 32768, '32767', '32768', 4.0, 4.5],
            'potencia' => [0, 1, 2147483647, 2147483648, '2147483647', '2147483648', 110.0, 110.5],
            'marca' => $text, 'modelo' => $text, 'motor' => $text,
            'version' => $text, 'descripcion' => [...$text, str_repeat('a', 2000), str_repeat('a', 2001)],
            'ubicacion' => [str_repeat('a', 150), str_repeat('a', 151), ...$text],
            'consumo_urbano' => $consumo, 'consumo_ruta' => $consumo,
        ];
    }

    private function assertSameVerdict(array $row, int $year, string $label): void
    {
        $expected = $this->validatorVerdict($row, $year);
        $this->assertSame($expected, VehiculoMatchingFacts::valid($row, $year),
            "Verdict differs from the validator for {$label} (year {$year}, expected ".($expected ? 'valid' : 'invalid').').');
    }

    public function test_a_complete_row_is_valid(): void
    {
        $this->assertTrue($this->validatorVerdict($this->baseRow(), self::YEAR));
        $this->assertTrue(VehiculoMatchingFacts::valid($this->baseRow(), self::YEAR));
    }

    public function test_every_field_matches_the_validator_on_each_edge_value(): void
    {
        $edges = $this->fieldEdges();
        $fields = array_diff(array_keys($this->baseRow()), ['id', 'origen', 'patente']);
        $checked = 0;
        foreach ($fields as $field) {
            $values = [...$this->commonEdges(), ...($edges[$field] ?? [])];
            foreach (['nafta', 'diesel', 'gnc', 'hibrido', 'electrico'] as $fuel) {
                if (! in_array($field, ['consumo_urbano', 'consumo_ruta'], true) && $fuel !== 'nafta') {
                    continue;
                }
                foreach ($values as $value) {
                    $row = [$field => $value, 'combustible' => $field === 'combustible' ? $value : $fuel] + $this->baseRow();
                    $this->assertSameVerdict($row, self::YEAR, "{$field} = ".var_export($value, true)." with {$fuel}");
                    $checked++;
                }
            }
            // A column the attributes do not carry at all.
            $row = $this->baseRow();
            unset($row[$field]);
            $this->assertSameVerdict($row, self::YEAR, "{$field} missing");
        }
        $this->assertGreaterThan(1000, $checked);
    }

    public function test_year_boundaries_follow_the_year_given(): void
    {
        foreach ([2026, 2030] as $year) {
            foreach ([1949, 1950, $year, $year + 1, $year + 2, (string) ($year + 1), (string) ($year + 2)] as $anio) {
                $this->assertSameVerdict(['anio' => $anio] + $this->baseRow(), $year, "anio = {$anio}");
            }
        }
    }

    public function test_combustibles_without_consumption_match_the_validator(): void
    {
        foreach (['nafta', 'diesel', 'gnc', 'hibrido', 'electrico'] as $fuel) {
            foreach ([null, '', '  ', '0.00', '6.00'] as $urban) {
                foreach ([null, '', '5.00'] as $road) {
                    $row = ['combustible' => $fuel, 'consumo_urbano' => $urban, 'consumo_ruta' => $road] + $this->baseRow();
                    $this->assertSameVerdict($row, self::YEAR, "{$fuel} urbano ".var_export($urban, true).' ruta '.var_export($road, true));
                }
            }
        }
    }

    public function test_random_combinations_match_the_validator(): void
    {
        mt_srand(20261026);
        $pool = $this->fieldEdges();
        $fields = array_diff(array_keys($this->baseRow()), ['id', 'origen', 'patente']);
        for ($i = 0; $i < 600; $i++) {
            $row = $this->baseRow();
            foreach ($fields as $field) {
                if (mt_rand(1, 100) <= 12) {
                    $values = [...$this->commonEdges(), ...($pool[$field] ?? [])];
                    $row[$field] = $values[mt_rand(0, count($values) - 1)];
                }
            }
            $this->assertSameVerdict($row, self::YEAR, 'random row #'.$i.' '.json_encode($row, JSON_PARTIAL_OUTPUT_ON_ERROR));
        }
    }

    public function test_the_check_is_cheap_enough_to_run_for_every_vehicle(): void
    {
        // Compared with the validator on the same machine: an absolute limit in ms fails on a slow CI runner.
        $row = $this->baseRow();
        VehiculoMatchingFacts::valid($row, self::YEAR);
        $time = function (callable $check): float {
            $start = hrtime(true);
            for ($i = 0; $i < 300; $i++) {
                $check();
            }

            return hrtime(true) - $start;
        };
        $pure = $time(fn () => VehiculoMatchingFacts::valid($row, self::YEAR));
        $validator = $time(fn () => $this->validatorVerdict($row, self::YEAR));

        $this->assertLessThan($validator / 10, $pure, 'The check should be at least 10 times faster than the validator (locally it is about 50 times).');
    }
}
