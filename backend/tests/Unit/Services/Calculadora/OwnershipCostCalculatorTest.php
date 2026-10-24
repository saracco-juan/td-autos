<?php

namespace Tests\Unit\Services\Calculadora;

use App\Services\Calculadora\OwnershipCostCalculator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class OwnershipCostCalculatorTest extends TestCase
{
    /** ARBA 2026 scale: tax = fixed + rate x (price - previous limit). */
    private const ARBA = [
        ['up_to' => 14100000, 'fixed' => 0, 'rate' => 0.01],
        ['up_to' => 18700000, 'fixed' => 141000, 'rate' => 0.02],
        ['up_to' => 26100000, 'fixed' => 233000, 'rate' => 0.03],
        ['up_to' => 53900000, 'fixed' => 455000, 'rate' => 0.04],
        ['up_to' => null, 'fixed' => 1567000, 'rate' => 0.045],
    ];

    /** Rates owned by the test: results never depend on config/calculadora.php. */
    private function rates(array $changes = []): array
    {
        return array_replace_recursive([
            'updated_at' => '2026-10-01',
            'rounding' => 1000,
            'fuel_prices' => ['nafta' => 1000, 'diesel' => 900, 'gnc' => 500],
            'insurance' => [
                'tc_base' => ['hatchback' => 103000, 'sedan' => 114000, 'rural' => 114000, 'suv' => 108000, 'pickup' => 152000, 'furgon' => 152000],
                'value_rate_tc' => 0.023,
                'zone_factor' => ['caba' => 1.0, 'buenos_aires' => 1.0, 'cordoba' => 0.8, 'santa_fe' => 0.78, 'mendoza' => 0.73, 'default' => 0.8],
                'tr_ratio' => ['hatchback' => 1.8, 'sedan' => 2.1, 'rural' => 2.1, 'suv' => 2.0, 'pickup' => 2.35, 'furgon' => 2.35],
                'value_rate_tr' => 0.06,
                'cpi_base_month' => '2026-10',
            ],
            'transfer' => [
                'dnrpa_rate' => 0.01,
                'fixed_costs' => 100000,
                'stamp_rate' => ['cordoba' => 0.02, 'caba' => 0.01, 'buenos_aires' => 0.03],
            ],
            'patente' => [
                'cpi_base_month' => '2026-02',
                'scale' => [
                    'buenos_aires' => self::ARBA,
                    'caba' => self::ARBA,
                ],
                'bracket_rate' => [
                    'cordoba' => [
                        ['up_to' => 5000000, 'rate' => 0.015], ['up_to' => 10000000, 'rate' => 0.02], ['up_to' => 20000000, 'rate' => 0.025],
                        ['up_to' => 50000000, 'rate' => 0.03], ['up_to' => 100000000, 'rate' => 0.0375], ['up_to' => null, 'rate' => 0.045],
                    ],
                ],
                'flat_rate' => ['mendoza' => 0.03, 'santa_fe' => 0.023, 'misiones' => 0.018],
            ],
            'maintenance' => [
                'annual_base' => ['nafta' => 600000, 'diesel' => 720000, 'gnc' => 660000, 'hibrido' => 480000, 'electrico' => 360000],
                'age_factors' => [['max' => 3, 'factor' => 1.0], ['max' => 7, 'factor' => 1.2], ['max' => null, 'factor' => 1.5]],
                'km_factors' => [['max' => 30000, 'factor' => 1.0], ['max' => 80000, 'factor' => 1.1], ['max' => null, 'factor' => 1.3]],
                'turbo_factor' => 1.1,
                'automatic_factor' => 1.2,
            ],
        ], $changes);
    }

    private function vehicle(array $changes = []): array
    {
        return array_replace([
            'price_ars' => 20000000, 'body_type' => 'Hatchback', 'fuel' => 'nafta', 'consumo_urbano' => 8, 'consumo_ruta' => 6,
            'anio' => 2022, 'kilometraje' => 40000, 'turbo' => false, 'transmision' => 'manual',
        ], $changes);
    }

    private function estimate(array $vehicle = [], string $province = 'Córdoba', int $km = 1500, string $coverage = 'terceros_completo', array $rates = []): array
    {
        return (new OwnershipCostCalculator)->calculate($this->vehicle($vehicle), $province, $km, $coverage, $this->rates($rates), 2026);
    }

    /*
     * Reference case (HU10 Escenario 3), computed by hand. Price 20.000.000 ARS, nafta, 8/6 L/100 km,
     * year 2022 (age 4), 40.000 km, no turbo, manual, Córdoba, 1.500 km/month, terceros completo.
     *
     * purchase.transfer = 20.000.000 x (0,01 + 0,02) + 100.000 = 700.000; total = 20.700.000
     * fuel        = 1.500 x max(8, 6) / 100 x 1.000 = 120.000
     * insurance   = max(103.000 (hatchback base), 20.000.000 x 0,023 / 12 = 38.333) x 0,8 (Córdoba) = 82.400 -> 83.000
     * patente     = 20.000.000 x 0,025 (Córdoba, up to 20.000.000, whole value) / 12 = 41.667 -> 42.000
     * maintenance = 600.000 x 1,2 (age 4 -> band <= 7) x 1,1 (40.000 km -> band <= 80.000) / 12 = 66.000
     * monthly total = 311.000; yearly = 3.732.000
     */
    public function test_reference_case(): void
    {
        $r = $this->estimate();

        $this->assertSame(['price' => 20000000, 'transfer' => 700000, 'total' => 20700000], $r['purchase']);
        $this->assertSame(120000, $r['monthly']['fuel']);
        $this->assertSame(83000, $r['monthly']['insurance']);
        $this->assertSame(42000, $r['monthly']['patente']);
        $this->assertSame(66000, $r['monthly']['maintenance']);
        $this->assertSame(311000, $r['monthly']['total']);
        $this->assertSame(3732000, $r['monthly']['yearly_total']);
        $this->assertSame([], $r['monthly']['not_estimated']);
    }

    public function test_reference_case_exposes_how_each_concept_was_calculated(): void
    {
        $this->assertEquals([
            'fuel' => ['km_per_month' => 1500, 'consumption_l_100km' => 8.0, 'fuel_type' => 'nafta', 'price_fuel_type' => 'nafta',
                'unit' => 'litro', 'unit_price' => 1000],
            'insurance' => ['coverage' => 'terceros_completo', 'base' => 20000000, 'body_type' => 'hatchback', 'body_label' => 'Hatchback',
                'base_monthly' => 103000, 'value_rate' => 0.023, 'by_value' => false, 'zone_factor' => 0.8, 'province' => 'Córdoba',
                'province_known' => true, 'tr_ratio' => null, 'terceros_completo' => 83000],
            'patente' => ['base' => 20000000, 'province' => 'Córdoba', 'province_known' => true, 'method' => 'bracket_rate', 'rate' => 0.025,
                'bracket_fixed' => null, 'bracket_from' => null, 'annual' => 500000],
            'maintenance' => ['fuel_type' => 'nafta', 'annual_base' => 600000, 'age_years' => 4, 'age_factor' => 1.2,
                'km' => 40000, 'km_factor' => 1.1, 'turbo_factor' => null, 'automatic_factor' => null],
            'transfer' => ['base' => 20000000, 'dnrpa_rate' => 0.01, 'stamp_rate' => 0.02, 'province' => 'Córdoba',
                'province_known' => true, 'fixed_costs' => 100000],
            'rounding' => 1000,
        ], $this->estimate()['breakdown']);
    }

    public function test_breakdown_fuel_is_null_when_fuel_is_not_estimated(): void
    {
        $this->assertNull($this->estimate(['fuel' => 'electrico'])['breakdown']['fuel']);
    }

    public function test_breakdown_flags_an_unknown_province_and_the_rate_used(): void
    {
        $b = $this->estimate(province: 'Atlantida')['breakdown'];

        $this->assertFalse($b['patente']['province_known']);
        $this->assertFalse($b['transfer']['province_known']);
        $this->assertSame('Atlantida', $b['patente']['province']);
        $this->assertSame('flat', $b['patente']['method']);
        $this->assertEquals(0.03, $b['patente']['rate']);
        $this->assertEquals(600000, $b['patente']['annual']);
        $this->assertEquals(0.03, $b['transfer']['stamp_rate']);
    }

    public function test_breakdown_uses_cubic_meters_for_gnc_and_nafta_price_for_hybrid(): void
    {
        $gnc = $this->estimate(['fuel' => 'gnc'])['breakdown']['fuel'];
        $this->assertSame('m3', $gnc['unit']);
        $this->assertSame('gnc', $gnc['price_fuel_type']);
        $this->assertEquals(500, $gnc['unit_price']);

        $hybrid = $this->estimate(['fuel' => 'hibrido'])['breakdown']['fuel'];
        $this->assertSame('hibrido', $hybrid['fuel_type']);
        $this->assertSame('nafta', $hybrid['price_fuel_type']);
        $this->assertSame('litro', $hybrid['unit']);
    }

    public function test_breakdown_reports_turbo_and_automatic_factors_only_when_they_apply(): void
    {
        $m = $this->estimate(['turbo' => true, 'transmision' => 'automatica'])['breakdown']['maintenance'];

        $this->assertEquals(1.1, $m['turbo_factor']);
        $this->assertEquals(1.2, $m['automatic_factor']);
    }

    public function test_every_concept_rounds_up_and_totals_sum_rounded_concepts(): void
    {
        $r = $this->estimate(['price_ars' => 20000001], rates: ['fuel_prices' => ['nafta' => 1000.4]]);

        // transfer 600.000,03 + 100.000 -> 701.000; price 20.000.001 -> 20.001.000
        $this->assertSame(20001000, $r['purchase']['price']);
        $this->assertSame(701000, $r['purchase']['transfer']);
        $this->assertSame(20702000, $r['purchase']['total']);
        // fuel 120.048 -> 121.000; insurance 82.400 -> 83.000; patente 50.000,0025 (3% bracket just over 20.000.000) -> 51.000
        $this->assertSame(121000, $r['monthly']['fuel']);
        $this->assertSame(83000, $r['monthly']['insurance']);
        $this->assertSame(51000, $r['monthly']['patente']);
        $this->assertSame(66000, $r['monthly']['maintenance']);
        $this->assertSame(121000 + 83000 + 51000 + 66000, $r['monthly']['total']);
        $this->assertSame($r['monthly']['total'] * 12, $r['monthly']['yearly_total']);
    }

    public function test_todo_riesgo_uses_its_own_insurance_rate(): void
    {
        // TC 83.000 (rounded) x 1,8 = 149.400 -> 150.000; the value floor is 20.000.000 x 0,06 / 12 = 100.000
        $this->assertSame(150000, $this->estimate(coverage: 'todo_riesgo')['monthly']['insurance']);
    }

    /** @return array<string, array{0: string, 1: int, 2: string, 3: int}> body, price, province, expected terceros completo */
    public static function terceros(): array
    {
        return [
            // Etios hatchback 18.870.000 in Buenos Aires: value floor 36.173 < base 103.000.
            'base wins over the value floor' => ['Hatchback', 18870000, 'Buenos Aires', 103000],
            // Hilux pickup 80.000.000: 80.000.000 x 0,023 / 12 = 153.333,3 > base 152.000 -> 154.000.
            'value floor wins over the base' => ['Pickup', 80000000, 'Buenos Aires', 154000],
            'every base: sedan' => ['Sedán', 1000000, 'CABA', 114000],
            'every base: rural' => ['Rural / familiar', 1000000, 'CABA', 114000],
            'every base: suv' => ['SUV', 1000000, 'CABA', 108000],
            'every base: furgon' => ['Furgón', 1000000, 'CABA', 152000],
            'unknown body type takes the highest base' => ['Camión', 1000000, 'CABA', 152000],
            'empty body type takes the highest base' => ['', 1000000, 'CABA', 152000],
            'zone cordoba' => ['Sedán', 1000000, 'Córdoba', 92000],
            'zone santa fe' => ['Sedán', 1000000, 'Santa Fe', 89000],
            'zone mendoza' => ['Sedán', 1000000, 'Mendoza', 84000],
            'zone caba spelled out' => ['Sedán', 1000000, 'Ciudad Autónoma de Buenos Aires', 114000],
            'unlisted province takes the default zone' => ['Sedán', 1000000, 'Salta', 92000],
            'unknown province takes the default zone' => ['Sedán', 1000000, 'Atlantida', 92000],
            'empty province takes the default zone' => ['Sedán', 1000000, '', 92000],
            // The zone factor multiplies whichever of the two wins: 153.333,3 x 0,8 = 122.666,7.
            'zone applies to the value floor too' => ['Pickup', 80000000, 'Córdoba', 123000],
        ];
    }

    #[DataProvider('terceros')]
    public function test_terceros_completo_is_the_base_or_the_value_floor_times_the_zone(string $body, int $price, string $province, int $expected): void
    {
        $r = $this->estimate(['body_type' => $body, 'price_ars' => $price], $province);

        $this->assertSame($expected, $r['monthly']['insurance']);
    }

    public function test_a_missing_body_type_takes_the_highest_base(): void
    {
        $r = $this->estimate(['body_type' => null, 'price_ars' => 1000000], 'CABA');

        $this->assertSame(152000, $r['monthly']['insurance']);
        $this->assertNull($r['breakdown']['insurance']['body_type']);
        $this->assertNull($r['breakdown']['insurance']['body_label']);
    }

    #[DataProvider('todoRiesgo')]
    public function test_todo_riesgo_is_terceros_times_the_ratio_or_the_value_floor(string $body, int $price, string $province, int $expected): void
    {
        $r = $this->estimate(['body_type' => $body, 'price_ars' => $price], $province, coverage: 'todo_riesgo');

        $this->assertSame($expected, $r['monthly']['insurance']);
    }

    /** @return array<string, array{0: string, 1: int, 2: string, 3: int}> */
    public static function todoRiesgo(): array
    {
        return [
            // Etios: TC 103.000 x 1,8 = 185.400 -> 186.000; value floor 18.870.000 x 0,06 / 12 = 94.350.
            'ratio wins over the value floor' => ['Hatchback', 18870000, 'Buenos Aires', 186000],
            // Hilux: TC 154.000 x 2,35 = 361.900; value floor 80.000.000 x 0,06 / 12 = 400.000.
            'value floor wins over the ratio' => ['Pickup', 80000000, 'Buenos Aires', 400000],
            'sedan ratio' => ['Sedán', 1000000, 'CABA', 240000],
            'rural ratio' => ['Rural / familiar', 1000000, 'CABA', 240000],
            'suv ratio' => ['SUV', 1000000, 'CABA', 216000],
            'pickup ratio' => ['Pickup', 1000000, 'CABA', 358000],
            'furgon ratio' => ['Furgón', 1000000, 'CABA', 358000],
            'unknown body type takes the highest base and ratio' => ['Camión', 1000000, 'CABA', 358000],
            // The zone is already inside the terceros completo the ratio multiplies: 91.200 -> 92.000 x 2,1 = 193.200.
            'zone flows through the ratio' => ['Sedán', 1000000, 'Córdoba', 194000],
        ];
    }

    public function test_the_todo_riesgo_ratio_multiplies_the_rounded_terceros_completo(): void
    {
        // Hatchback in Córdoba: TC 103.000 x 0,8 = 82.400, shown as 83.000. The ratio applies to the shown 83.000
        // (149.400 -> 150.000), not to 82.400 (148.320 -> 149.000), so the screen explains itself.
        $r = $this->estimate(['body_type' => 'Hatchback', 'price_ars' => 10000000], 'Córdoba', coverage: 'todo_riesgo');

        $this->assertSame(150000, $r['monthly']['insurance']);
        $this->assertSame(83000, $r['breakdown']['insurance']['terceros_completo']);
    }

    public function test_insurance_breakdown_for_a_value_floor_terceros_completo(): void
    {
        $b = $this->estimate(['body_type' => 'Pickup', 'price_ars' => 80000000], 'Buenos Aires')['breakdown']['insurance'];

        $this->assertEquals([
            'coverage' => 'terceros_completo', 'base' => 80000000, 'body_type' => 'pickup', 'body_label' => 'Pickup',
            'base_monthly' => 152000, 'value_rate' => 0.023, 'by_value' => true, 'zone_factor' => 1.0, 'province' => 'Buenos Aires',
            'province_known' => true, 'tr_ratio' => null, 'terceros_completo' => 154000,
        ], $b);
    }

    public function test_insurance_breakdown_for_todo_riesgo(): void
    {
        $b = $this->estimate(['body_type' => 'Pickup', 'price_ars' => 80000000], 'Buenos Aires', coverage: 'todo_riesgo')['breakdown']['insurance'];

        $this->assertEquals([
            'coverage' => 'todo_riesgo', 'base' => 80000000, 'body_type' => 'pickup', 'body_label' => 'Pickup',
            'base_monthly' => 152000, 'value_rate' => 0.06, 'by_value' => true, 'zone_factor' => 1.0, 'province' => 'Buenos Aires',
            'province_known' => true, 'tr_ratio' => 2.35, 'terceros_completo' => 154000,
        ], $b);

        $ratio = $this->estimate(['body_type' => 'Hatchback', 'price_ars' => 18870000], 'Buenos Aires', coverage: 'todo_riesgo')['breakdown']['insurance'];
        $this->assertFalse($ratio['by_value']);
        $this->assertEquals(1.8, $ratio['tr_ratio']);
    }

    public function test_insurance_breakdown_flags_an_unlisted_province_and_uses_the_default_zone_factor(): void
    {
        $b = $this->estimate(province: 'Atlantida')['breakdown']['insurance'];

        $this->assertFalse($b['province_known']);
        $this->assertSame('Atlantida', $b['province']);
        $this->assertEquals(0.8, $b['zone_factor']);
    }

    public function test_the_indexed_bases_come_from_the_rates_it_receives(): void
    {
        // EffectiveRates scales tc_base; the calculator only reads it: 113.300 x 0,8 = 90.640 -> 91.000.
        $r = $this->estimate(rates: ['insurance' => ['tc_base' => ['hatchback' => 113300]]]);

        $this->assertSame(91000, $r['monthly']['insurance']);
        $this->assertEquals(113300, $r['breakdown']['insurance']['base_monthly']);
    }

    public function test_diesel_uses_diesel_price_and_hybrid_uses_nafta_price(): void
    {
        $this->assertSame(108000, $this->estimate(['fuel' => 'diesel'])['monthly']['fuel']);
        $this->assertSame(120000, $this->estimate(['fuel' => 'hibrido'])['monthly']['fuel']);
    }

    public function test_gnc_reads_consumption_as_cubic_meters_per_100_km(): void
    {
        // 1.500 x 8 / 100 x 500 = 60.000
        $this->assertSame(60000, $this->estimate(['fuel' => 'gnc'])['monthly']['fuel']);
    }

    public function test_fuel_takes_the_higher_consumption_figure(): void
    {
        $this->assertSame(150000, $this->estimate(['consumo_urbano' => 6, 'consumo_ruta' => 10])['monthly']['fuel']);
    }

    public function test_one_missing_consumption_figure_uses_the_other(): void
    {
        $this->assertSame(90000, $this->estimate(['consumo_urbano' => null, 'consumo_ruta' => 6])['monthly']['fuel']);
    }

    public function test_electric_vehicle_has_no_fuel_estimate(): void
    {
        $r = $this->estimate(['fuel' => 'electrico']);

        $this->assertNull($r['monthly']['fuel']);
        $this->assertSame(['fuel'], $r['monthly']['not_estimated']);
        $this->assertSame($r['monthly']['insurance'] + $r['monthly']['patente'] + $r['monthly']['maintenance'], $r['monthly']['total']);
    }

    public function test_missing_consumption_has_no_fuel_estimate(): void
    {
        $r = $this->estimate(['consumo_urbano' => null, 'consumo_ruta' => null]);

        $this->assertNull($r['monthly']['fuel']);
        $this->assertSame(['fuel'], $r['monthly']['not_estimated']);
        $this->assertSame(191000, $r['monthly']['total']);
    }

    #[DataProvider('maintenanceCases')]
    public function test_maintenance_factors(array $changes, int $expected): void
    {
        $this->assertSame($expected, $this->estimate($changes)['monthly']['maintenance']);
    }

    public static function maintenanceCases(): array
    {
        return [
            'new car, low km (band 1 both)' => [['anio' => 2025, 'kilometraje' => 10000], 50000],
            'age on the band limit stays in the band' => [['anio' => 2023, 'kilometraje' => 10000], 50000],
            'old car, open band' => [['anio' => 2010, 'kilometraje' => 10000], 75000],
            'high km, open band' => [['anio' => 2025, 'kilometraje' => 200000], 65000],
            'turbo' => [['anio' => 2025, 'kilometraje' => 10000, 'turbo' => true], 55000],
            'automatic' => [['anio' => 2025, 'kilometraje' => 10000, 'transmision' => 'automatica'], 60000],
            'diesel base' => [['anio' => 2025, 'kilometraje' => 10000, 'fuel' => 'diesel'], 60000],
            'future year counts as age 0' => [['anio' => 2027, 'kilometraje' => 0], 50000],
        ];
    }

    #[DataProvider('provinces')]
    public function test_province_normalization(string $input, int $expectedTransfer): void
    {
        // base 20.000.000 x (0,01 + stamp) + 100.000
        $this->assertSame($expectedTransfer, $this->estimate(province: $input)['purchase']['transfer']);
    }

    public static function provinces(): array
    {
        return [
            'accents and case' => ['CÓRDOBA', 700000],
            'padding' => ['  córdoba ', 700000],
            'caba' => ['CABA', 500000],
            'capital federal' => ['Capital Federal', 500000],
            'ciudad autonoma' => ['Ciudad Autónoma de Buenos Aires', 500000],
            'ciudad de buenos aires' => ['Ciudad de Buenos Aires', 500000],
            'provincia de buenos aires' => ['Provincia de Buenos Aires', 900000],
            'pba' => ['PBA', 900000],
            'spaces and hyphens' => ['buenos-aires', 900000],
            'unknown takes the highest rate' => ['Atlantida', 900000],
            'empty takes the highest rate' => ['', 900000],
        ];
    }

    public function test_unknown_province_takes_the_highest_flat_patente_rate(): void
    {
        // highest flat rate 0,03 -> 20.000.000 x 0,03 / 12 = 50.000
        $this->assertSame(50000, $this->estimate(province: 'Nowhere')['monthly']['patente']);
    }

    public function test_a_flat_province_pays_its_rate_over_the_price(): void
    {
        // Santa Fe 0,023: 20.000.000 x 0,023 / 12 = 38.333,3 -> 39.000
        $r = $this->estimate(province: 'Santa Fe');

        $this->assertSame(39000, $r['monthly']['patente']);
        $this->assertEquals(['base' => 20000000, 'province' => 'Santa Fe', 'province_known' => true, 'method' => 'flat', 'rate' => 0.023,
            'bracket_fixed' => null, 'bracket_from' => null, 'annual' => 460000], $r['breakdown']['patente']);
    }

    /** @return array<string, array{0: int, 1: int, 2: int, 3: int}> price, expected annual, bracket fixed, bracket from */
    public static function arbaBrackets(): array
    {
        return [
            'first bracket' => [10000000, 100000, 0, 0],
            'first limit stays in the first bracket' => [14100000, 141000, 0, 0],
            'just over the first limit' => [14100001, 141000, 141000, 14100000],
            'second bracket' => [16000000, 179000, 141000, 14100000],
            'second limit stays in the second bracket' => [18700000, 233000, 141000, 14100000],
            'third bracket (calibration case)' => [20600000, 290000, 233000, 18700000],
            'third limit stays in the third bracket' => [26100000, 455000, 233000, 18700000],
            'fourth bracket' => [40000000, 1011000, 455000, 26100000],
            'fourth limit stays in the fourth bracket' => [53900000, 1567000, 455000, 26100000],
            'open bracket' => [60000000, 1841500, 1567000, 53900000],
        ];
    }

    #[DataProvider('arbaBrackets')]
    public function test_buenos_aires_uses_the_progressive_arba_scale(int $price, int $annual, int $fixed, int $from): void
    {
        $r = $this->estimate(['price_ars' => $price], 'Buenos Aires');

        $this->assertSame($this->ceilTo($annual / 12), $r['monthly']['patente']);
        $this->assertSame('scale', $r['breakdown']['patente']['method']);
        $this->assertEqualsWithDelta($annual, $r['breakdown']['patente']['annual'], 1.0);
        $this->assertEquals($fixed, $r['breakdown']['patente']['bracket_fixed']);
        $this->assertEquals($from, $r['breakdown']['patente']['bracket_from']);
    }

    private function ceilTo(float $amount): int
    {
        return (int) (ceil(round($amount / 1000, 6)) * 1000);
    }

    public function test_caba_uses_the_same_scale_as_buenos_aires(): void
    {
        $caba = $this->estimate(['price_ars' => 20600000], 'CABA')['breakdown']['patente'];

        $this->assertSame('scale', $caba['method']);
        $this->assertEquals(290000, $caba['annual']);
    }

    /**
     * Calibration case 1: a hatchback priced 20.600.000 in Buenos Aires.
     * Annual = 233.000 + 3% x (20.600.000 - 18.700.000) = 290.000; monthly = 24.166,67, rounded UP to the 1.000 step = 25.000.
     */
    public function test_calibration_case_hatchback_in_buenos_aires(): void
    {
        $r = $this->estimate(['price_ars' => 20600000], 'Provincia de Buenos Aires');

        $this->assertEquals(290000, $r['breakdown']['patente']['annual']);
        $this->assertSame(25000, $r['monthly']['patente']);
    }

    /** @return array<string, array{0: int, 1: float}> price, whole-value rate */
    public static function cordobaBrackets(): array
    {
        return [
            'up to 5M' => [5000000, 0.015],
            'just over 5M' => [5000001, 0.02],
            'up to 10M' => [10000000, 0.02],
            'up to 20M' => [20000000, 0.025],
            'just over 20M' => [20000001, 0.03],
            'up to 50M' => [50000000, 0.03],
            'up to 100M' => [100000000, 0.0375],
            'above 100M' => [120000000, 0.045],
        ];
    }

    #[DataProvider('cordobaBrackets')]
    public function test_cordoba_applies_the_bracket_rate_to_the_whole_price(int $price, float $rate): void
    {
        $r = $this->estimate(['price_ars' => $price], 'Córdoba');

        $this->assertSame('bracket_rate', $r['breakdown']['patente']['method']);
        $this->assertEquals($rate, $r['breakdown']['patente']['rate']);
        $this->assertEqualsWithDelta($price * $rate, $r['breakdown']['patente']['annual'], 0.001);
        $this->assertSame($this->ceilTo($price * $rate / 12), $r['monthly']['patente']);
    }

    public function test_the_scale_limits_and_fixed_amounts_come_from_the_rates_it_receives(): void
    {
        // The refresh multiplies limits and fixed amounts (never the rates) by the CPI factor; the calculator just reads them.
        $indexed = array_map(fn ($b) => [
            'up_to' => $b['up_to'] === null ? null : (int) round($b['up_to'] * 1.1),
            'fixed' => (int) round($b['fixed'] * 1.1),
            'rate' => $b['rate'],
        ], self::ARBA);

        $r = $this->estimate(['price_ars' => 20600000], 'Buenos Aires', rates: ['patente' => ['scale' => ['buenos_aires' => $indexed]]]);

        // 18.700.000 x 1,1 = 20.570.000: the price is now in the bracket that starts there.
        // Fixed 233.000 x 1,1 = 256.300 + 3% x (20.600.000 - 20.570.000) = 257.200.
        $this->assertEquals(257200, $r['breakdown']['patente']['annual']);
        $this->assertEquals(20570000, $r['breakdown']['patente']['bracket_from']);
    }

    #[DataProvider('kmBands')]
    public function test_fuel_scales_with_km_per_month(int $km, int $expected): void
    {
        $this->assertSame($expected, $this->estimate(km: $km)['monthly']['fuel']);
    }

    public static function kmBands(): array
    {
        return [[0, 0], [500, 40000], [3000, 240000], [4500, 360000]];
    }
}
