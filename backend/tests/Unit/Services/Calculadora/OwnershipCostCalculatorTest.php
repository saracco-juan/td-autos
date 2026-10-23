<?php

namespace Tests\Unit\Services\Calculadora;

use App\Services\Calculadora\OwnershipCostCalculator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class OwnershipCostCalculatorTest extends TestCase
{
    /** Rates owned by the test: results never depend on config/calculadora.php. */
    private function rates(array $changes = []): array
    {
        return array_replace_recursive([
            'updated_at' => '2026-10-01',
            'rounding' => 1000,
            'fuel_prices' => ['nafta' => 1000, 'diesel' => 900, 'gnc' => 500],
            'insurance_annual_rate' => ['terceros_completo' => 0.06, 'todo_riesgo' => 0.12],
            'transfer' => [
                'dnrpa_rate' => 0.01,
                'fixed_costs' => 100000,
                'stamp_rate' => ['cordoba' => 0.02, 'caba' => 0.01, 'buenos_aires' => 0.03],
            ],
            'patente_annual_rate' => ['cordoba' => 0.012, 'caba' => 0.01, 'buenos_aires' => 0.02],
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
            'price_ars' => 20000000, 'fuel' => 'nafta', 'consumo_urbano' => 8, 'consumo_ruta' => 6,
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
     * insurance   = 20.000.000 x 0,06 / 12 = 100.000
     * patente     = 20.000.000 x 0,012 / 12 = 20.000
     * maintenance = 600.000 x 1,2 (age 4 -> band <= 7) x 1,1 (40.000 km -> band <= 80.000) / 12 = 66.000
     * monthly total = 306.000; yearly = 3.672.000
     */
    public function test_reference_case(): void
    {
        $r = $this->estimate();

        $this->assertSame(['price' => 20000000, 'transfer' => 700000, 'total' => 20700000], $r['purchase']);
        $this->assertSame(120000, $r['monthly']['fuel']);
        $this->assertSame(100000, $r['monthly']['insurance']);
        $this->assertSame(20000, $r['monthly']['patente']);
        $this->assertSame(66000, $r['monthly']['maintenance']);
        $this->assertSame(306000, $r['monthly']['total']);
        $this->assertSame(3672000, $r['monthly']['yearly_total']);
        $this->assertSame([], $r['monthly']['not_estimated']);
    }

    public function test_every_concept_rounds_up_and_totals_sum_rounded_concepts(): void
    {
        $r = $this->estimate(['price_ars' => 20000001], rates: ['fuel_prices' => ['nafta' => 1000.4]]);

        // transfer 600.000,03 + 100.000 -> 701.000; price 20.000.001 -> 20.001.000
        $this->assertSame(20001000, $r['purchase']['price']);
        $this->assertSame(701000, $r['purchase']['transfer']);
        $this->assertSame(20702000, $r['purchase']['total']);
        // fuel 120.048 -> 121.000; insurance 100.000,005 -> 101.000; patente 20.000,002 -> 21.000
        $this->assertSame(121000, $r['monthly']['fuel']);
        $this->assertSame(101000, $r['monthly']['insurance']);
        $this->assertSame(21000, $r['monthly']['patente']);
        $this->assertSame(66000, $r['monthly']['maintenance']);
        $this->assertSame(121000 + 101000 + 21000 + 66000, $r['monthly']['total']);
        $this->assertSame($r['monthly']['total'] * 12, $r['monthly']['yearly_total']);
    }

    public function test_todo_riesgo_uses_its_own_insurance_rate(): void
    {
        $this->assertSame(200000, $this->estimate(coverage: 'todo_riesgo')['monthly']['insurance']);
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
        $this->assertSame(186000, $r['monthly']['total']);
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

    public function test_unknown_province_takes_the_highest_patente_rate(): void
    {
        // highest patente rate 0,02 -> 20.000.000 x 0,02 / 12 = 33.333,3 -> 34.000
        $this->assertSame(34000, $this->estimate(province: 'Nowhere')['monthly']['patente']);
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
