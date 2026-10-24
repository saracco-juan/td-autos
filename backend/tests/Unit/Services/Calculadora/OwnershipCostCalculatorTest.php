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
            'service' => [
                'fuel_factor' => ['nafta' => 1.0, 'diesel' => 1.0, 'hibrido' => 1.0, 'gnc' => 1.15, 'electrico' => 0.5],
                'brands' => [
                    'toyota' => [
                        'label' => 'Toyota', 'aliases' => [], 'interval_km' => 10000, 'interval_months' => 12, 'cpi_base_month' => '2026-08',
                        'models' => ['etios' => 315000, 'yaris' => 361000, 'corolla' => 486000, 'corolla cross' => 487000, 'hilux' => 593000],
                        'body' => ['hatchback' => 361000, 'sedan' => 486000, 'suv' => 486000, 'rural' => 486000, 'pickup' => 593000, 'furgon' => 593000],
                    ],
                    'volkswagen' => [
                        'label' => 'Volkswagen', 'aliases' => ['vw'], 'interval_km' => 15000, 'interval_months' => 12, 'cpi_base_month' => '2025-12',
                        'models' => ['gol' => 326000, 'polo' => 383000, 'amarok' => 650000],
                        'model_overrides' => ['amarok' => ['interval_km' => 10000]],
                        'body' => ['hatchback' => 383000, 'sedan' => 383000, 'suv' => 456000, 'rural' => 456000, 'pickup' => 650000, 'furgon' => 650000],
                    ],
                    'fiat' => [
                        'label' => 'Fiat', 'aliases' => [], 'interval_km' => 10000, 'interval_months' => 12, 'cpi_base_month' => '2025-09',
                        'models' => ['cronos' => 378000],
                        'body' => ['hatchback' => 271000, 'sedan' => 378000],
                    ],
                ],
                'fallback' => [
                    'interval_km' => 10000, 'interval_months' => 12, 'cpi_base_month' => '2025-09',
                    'body' => ['hatchback' => 200000, 'sedan' => 380000, 'suv' => 340000, 'rural' => 340000, 'furgon' => 340000, 'pickup' => 400000],
                ],
            ],
        ], $changes);
    }

    private function vehicle(array $changes = []): array
    {
        return array_replace([
            'price_ars' => 20000000, 'marca' => 'Renault', 'modelo' => 'Sandero', 'body_type' => 'Hatchback', 'fuel' => 'nafta', 'consumo_urbano' => 8, 'consumo_ruta' => 6,
            'anio' => 2022,
        ], $changes);
    }

    private function estimate(array $vehicle = [], string $province = 'Córdoba', int $km = 1500, string $coverage = 'terceros_completo', array $rates = []): array
    {
        return (new OwnershipCostCalculator)->calculate($this->vehicle($vehicle), $province, $km, $coverage, $this->rates($rates), 2026);
    }

    /*
     * Reference case (HU10 Escenario 3), computed by hand. Price 20.000.000 ARS, nafta, 8/6 L/100 km,
     * year 2022 (age 4), Córdoba, 1.500 km/month, terceros completo.
     *
     * purchase.transfer = 20.000.000 x (0,01 + 0,02) + 100.000 = 700.000; total = 20.700.000
     * fuel        = 1.500 x max(8, 6) / 100 x 1.000 = 120.000
     * insurance   = max(103.000 (hatchback base), 20.000.000 x 0,023 / 12 = 38.333) x 0,8 (Córdoba) = 82.400 -> 83.000
     * patente     = 20.000.000 x 0,025 (Córdoba, up to 20.000.000, whole value) / 12 = 41.667 -> 42.000
     * monthly total = 120.000 + 83.000 + 42.000 = 245.000 (the service is not monthly)
     * service     = ceil(max(18.000 km / 10.000 km, 12 / 12 months)) = 2 services x 200.000 (fallback hatchback) x 1,0 = 400.000 per year
     * yearly total = 245.000 x 12 + 400.000 = 3.340.000
     */
    public function test_reference_case(): void
    {
        $r = $this->estimate();

        $this->assertSame(['price' => 20000000, 'transfer' => 700000, 'total' => 20700000], $r['purchase']);
        $this->assertSame(120000, $r['monthly']['fuel']);
        $this->assertSame(83000, $r['monthly']['insurance']);
        $this->assertSame(42000, $r['monthly']['patente']);
        $this->assertArrayNotHasKey('maintenance', $r['monthly']);
        $this->assertArrayNotHasKey('yearly_total', $r['monthly']);
        $this->assertSame(245000, $r['monthly']['total']);
        $this->assertSame(['service' => 400000, 'total' => 3340000], $r['yearly']);
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
            'service' => ['brand' => null, 'brand_known' => false, 'model_matched' => false, 'body_type' => 'hatchback', 'body_label' => 'Hatchback',
                'km_per_year' => 18000, 'interval_km' => 10000, 'interval_months' => 12, 'services_per_year' => 2,
                'price_per_service' => 200000, 'fuel_factor' => 1.0, 'source_label' => 'valor de referencia'],
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

    public function test_breakdown_reports_the_fuel_factor_and_an_unknown_body_type(): void
    {
        $gnc = $this->estimate(['fuel' => 'gnc'])['breakdown']['service'];
        $this->assertEquals(1.15, $gnc['fuel_factor']);

        $unknown = $this->estimate(['body_type' => 'Cupé'])['breakdown']['service'];
        $this->assertNull($unknown['body_type']);
        $this->assertNull($unknown['body_label']);
        $this->assertEquals(400000, $unknown['price_per_service']);
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
        $this->assertSame(121000 + 83000 + 51000, $r['monthly']['total']);
        $this->assertSame($r['monthly']['total'] * 12 + $r['yearly']['service'], $r['yearly']['total']);
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
        $this->assertSame($r['monthly']['insurance'] + $r['monthly']['patente'], $r['monthly']['total']);
    }

    public function test_missing_consumption_has_no_fuel_estimate(): void
    {
        $r = $this->estimate(['consumo_urbano' => null, 'consumo_ruta' => null]);

        $this->assertNull($r['monthly']['fuel']);
        $this->assertSame(['fuel'], $r['monthly']['not_estimated']);
        $this->assertSame(125000, $r['monthly']['total']);
    }

    /** @return array<string, mixed> the `service` breakdown of an estimate */
    private function service(array $vehicle = [], int $km = 1500, array $rates = []): array
    {
        return $this->estimate($vehicle, km: $km, rates: $rates)['breakdown']['service'];
    }

    /**
     * Services per year = ceil(max(km per year / interval km, 12 / interval months)). Fallback: 10.000 km / 12 months.
     */
    #[DataProvider('servicesPerYear')]
    public function test_services_per_year(int $kmPerMonth, int $expected): void
    {
        $this->assertSame($expected, $this->service(km: $kmPerMonth)['services_per_year']);
    }

    public static function servicesPerYear(): array
    {
        return [
            'no km: the time rule asks for one' => [0, 1],
            'few km: the time rule wins' => [500, 1],
            'just under one interval a year' => [833, 1],
            'just over one interval a year rounds up' => [834, 2],
            'km rule: 1.2 services rounds up to 2' => [1000, 2],
            'km rule: 1.8 services rounds up to 2' => [1500, 2],
            'km rule: 2.0004 services rounds up to 3' => [1667, 3],
            'heavy use' => [4500, 6],
        ];
    }

    public function test_the_interval_in_months_can_ask_for_more_services_than_the_km(): void
    {
        $b = $this->service(km: 0, rates: ['service' => ['fallback' => ['interval_months' => 6]]]);

        $this->assertSame(2, $b['services_per_year']);
        $this->assertSame(6, $b['interval_months']);
    }

    public function test_an_exact_number_of_intervals_does_not_round_up_by_float_noise(): void
    {
        // Volkswagen 15.000 km: 1.250 km per month = exactly one interval a year; 2.500 = exactly two.
        $this->assertSame(1, $this->service(['marca' => 'Volkswagen', 'modelo' => 'Polo'], km: 1250)['services_per_year']);
        $this->assertSame(2, $this->service(['marca' => 'Volkswagen', 'modelo' => 'Polo'], km: 2500)['services_per_year']);
    }

    /** @return array<string, array{0: array<string, mixed>, 1: int, 2: string}> vehicle, price per service, source label */
    public static function priceLookups(): array
    {
        return [
            'brand and model' => [['marca' => 'Toyota', 'modelo' => 'Yaris', 'body_type' => 'Hatchback'], 361000, 'service oficial Toyota Yaris'],
            'the model decides over the body type' => [['marca' => 'Toyota', 'modelo' => 'Hilux', 'body_type' => 'SUV'], 593000, 'service oficial Toyota Hilux'],
            'corolla cross is not corolla' => [['marca' => 'Toyota', 'modelo' => 'Corolla Cross', 'body_type' => 'SUV'], 487000, 'service oficial Toyota Corolla Cross'],
            'corolla with a trim' => [['marca' => 'Toyota', 'modelo' => 'Corolla XEI', 'body_type' => 'Sedán'], 486000, 'service oficial Toyota Corolla XEI'],
            'gol trend matches gol' => [['marca' => 'Volkswagen', 'modelo' => 'Gol Trend', 'body_type' => 'Hatchback'], 326000, 'service oficial Volkswagen Gol Trend'],
            'gol does not match golf' => [['marca' => 'Volkswagen', 'modelo' => 'Golf', 'body_type' => 'Hatchback'], 383000, 'service oficial Volkswagen'],
            'vw alias' => [['marca' => 'VW', 'modelo' => 'Polo', 'body_type' => 'Hatchback'], 383000, 'service oficial Volkswagen Polo'],
            'brand in capitals' => [['marca' => 'VOLKSWAGEN', 'modelo' => 'POLO', 'body_type' => 'Hatchback'], 383000, 'service oficial Volkswagen POLO'],
            'accents and padding' => [['marca' => '  Fíat ', 'modelo' => 'Cronos', 'body_type' => 'Sedán'], 378000, 'service oficial Fiat Cronos'],
            'brand and body type when the model is not listed' => [['marca' => 'Toyota', 'modelo' => 'Prius', 'body_type' => 'Hatchback'], 361000, 'service oficial Toyota'],
            'brand without that body type uses the reference' => [['marca' => 'Fiat', 'modelo' => 'Strada', 'body_type' => 'Pickup'], 400000, 'valor de referencia'],
            'an unknown brand uses the reference' => [['marca' => 'Citroën', 'modelo' => 'C3', 'body_type' => 'Hatchback'], 200000, 'valor de referencia'],
            'bmw has no data and uses the reference' => [['marca' => 'BMW', 'modelo' => 'Serie 1', 'body_type' => 'Hatchback'], 200000, 'valor de referencia'],
            'unknown body type takes the highest reference' => [['marca' => 'BMW', 'modelo' => 'X', 'body_type' => 'Cupé'], 400000, 'valor de referencia'],
            'missing body type takes the highest reference' => [['marca' => 'Toyota', 'modelo' => 'Prius', 'body_type' => null], 400000, 'valor de referencia'],
            'missing brand and model use the reference' => [['marca' => null, 'modelo' => null], 200000, 'valor de referencia'],
        ];
    }

    #[DataProvider('priceLookups')]
    public function test_price_lookup_order(array $vehicle, int $price, string $source): void
    {
        $b = $this->service($vehicle);

        $this->assertSame($price, (int) $b['price_per_service']);
        $this->assertSame($source, $b['source_label']);
    }

    public function test_the_breakdown_flags_what_matched(): void
    {
        $model = $this->service(['marca' => 'Toyota', 'modelo' => 'Yaris', 'body_type' => 'Hatchback']);
        $this->assertSame('Toyota', $model['brand']);
        $this->assertTrue($model['brand_known']);
        $this->assertTrue($model['model_matched']);

        $body = $this->service(['marca' => 'Toyota', 'modelo' => 'Prius', 'body_type' => 'Hatchback']);
        $this->assertTrue($body['brand_known']);
        $this->assertFalse($body['model_matched']);

        $unknown = $this->service(['marca' => 'BMW', 'modelo' => 'X1', 'body_type' => 'SUV']);
        $this->assertFalse($unknown['brand_known']);
        $this->assertNull($unknown['brand']);
    }

    public function test_the_service_for_a_listed_vehicle_is_services_times_price(): void
    {
        // Yaris, 1.500 km a month: 18.000 / 10.000 -> 2 services x 361.000 = 722.000 per year.
        $r = $this->estimate(['marca' => 'Toyota', 'modelo' => 'Yaris', 'body_type' => 'Hatchback']);

        $this->assertSame(722000, $r['yearly']['service']);
        $this->assertSame(18000, $r['breakdown']['service']['km_per_year']);
        $this->assertSame(10000, $r['breakdown']['service']['interval_km']);
        $this->assertSame(2, $r['breakdown']['service']['services_per_year']);
    }

    public function test_the_amarok_uses_its_own_interval_and_the_brand_keeps_the_default(): void
    {
        // 1.000 km a month = 12.000 km a year: Amarok every 10.000 km -> 2 services; any other Volkswagen every 15.000 -> 1.
        $amarok = $this->service(['marca' => 'Volkswagen', 'modelo' => 'Amarok V6', 'body_type' => 'Pickup'], km: 1000);
        $this->assertSame(10000, $amarok['interval_km']);
        $this->assertSame(2, $amarok['services_per_year']);

        $polo = $this->service(['marca' => 'Volkswagen', 'modelo' => 'Polo', 'body_type' => 'Hatchback'], km: 1000);
        $this->assertSame(15000, $polo['interval_km']);
        $this->assertSame(1, $polo['services_per_year']);
    }

    public function test_a_volkswagen_pickup_that_is_not_the_amarok_keeps_the_brand_interval(): void
    {
        $pickup = $this->service(['marca' => 'Volkswagen', 'modelo' => 'Saveiro', 'body_type' => 'Pickup'], km: 1000);

        $this->assertSame(15000, $pickup['interval_km']);
        $this->assertSame(650000, (int) $pickup['price_per_service']);
    }

    public function test_the_fuel_factor_scales_the_yearly_service(): void
    {
        $this->assertSame(400000, $this->estimate()['yearly']['service']);
        // 2 x 200.000 x 1,15 = 460.000
        $this->assertSame(460000, $this->estimate(['fuel' => 'gnc'])['yearly']['service']);
        $this->assertSame(200000, $this->estimate(['fuel' => 'electrico'])['yearly']['service']);
        $this->assertSame(400000, $this->estimate(['fuel' => 'diesel'])['yearly']['service']);
        $this->assertSame(400000, $this->estimate(['fuel' => 'hibrido'])['yearly']['service']);
        $this->assertEquals(0.5, $this->service(['fuel' => 'electrico'])['fuel_factor']);
    }

    public function test_the_yearly_service_rounds_up_and_the_totals_add_up(): void
    {
        // 2 x 200.100 x 1,15 = 460.230 -> 461.000
        $r = $this->estimate(['fuel' => 'gnc'], rates: ['service' => ['fallback' => ['body' => ['hatchback' => 200100]]]]);

        $this->assertSame(461000, $r['yearly']['service']);
        $this->assertSame($r['monthly']['total'] * 12 + 461000, $r['yearly']['total']);
        $this->assertArrayNotHasKey('maintenance', $r['monthly']);
    }

    public function test_no_km_still_costs_one_service_a_year(): void
    {
        $this->assertSame(200000, $this->estimate(km: 0)['yearly']['service']);
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
