<?php

namespace Tests\Feature\Calculadora;

use App\Services\Calculadora\OwnershipCostCalculator;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The 2026 patente rules as they are written in config/calculadora.php (not as a test double): each case is computed by
 * hand from the law or tariff it names, so a mistyped bracket in the config fails here.
 */
class PatenteConfigTest extends TestCase
{
    /** @param  array<string, mixed>  $vehicle */
    private function patente(array $vehicle, string $province): array
    {
        $vehicle += ['marca' => 'Renault', 'modelo' => 'Sandero', 'body_type' => 'Sedán', 'fuel' => 'nafta', 'consumo_urbano' => 8, 'consumo_ruta' => 6];

        return (new OwnershipCostCalculator)->calculate($vehicle, $province, 1500, 'terceros_completo', (array) config('calculadora'), 2026);
    }

    public function test_caba_reference_case(): void
    {
        // Ley 6927 art. 50: 1.477.000 + 6,5% x (38.985.600 - 36.550.000) = 1.635.314; +10% = 1.798.845,4 a year; cap 6% = 2.339.136.
        $r = $this->patente(['price_ars' => 38985600, 'anio' => 2022], 'CABA');

        $this->assertEqualsWithDelta(1798845.4, $r['breakdown']['patente']['annual'], 0.01);
        $this->assertFalse($r['breakdown']['patente']['cap_applied']);
        $this->assertSame(150000, $r['monthly']['patente']);
    }

    public function test_caba_exempts_a_1999_car(): void
    {
        $r = $this->patente(['price_ars' => 5000000, 'anio' => 1999], 'Ciudad Autónoma de Buenos Aires');

        $this->assertTrue($r['breakdown']['patente']['exempt']);
        $this->assertSame(0, $r['monthly']['patente']);
    }

    public function test_caba_charges_its_minimum_and_caps_at_six_percent(): void
    {
        $cheap = $this->patente(['price_ars' => 500000, 'anio' => 2020], 'CABA')['breakdown']['patente'];
        $this->assertTrue($cheap['minimum_applied']);
        $this->assertEquals(13300, $cheap['annual']);

        // 100.000.000: 3.965.000 + 8% x 26.900.000 = 6.117.000; +10% = 6.728.700 -> capped at 6.000.000.
        $dear = $this->patente(['price_ars' => 100000000, 'anio' => 2025], 'CABA')['breakdown']['patente'];
        $this->assertTrue($dear['cap_applied']);
        $this->assertEquals(6000000, $dear['annual']);
    }

    public function test_buenos_aires_keeps_the_arba_scale_and_exempts_from_25_years(): void
    {
        // 233.000 + 3% x (20.600.000 - 18.700.000) = 290.000 a year.
        $this->assertEquals(290000, $this->patente(['price_ars' => 20600000, 'anio' => 2022], 'Buenos Aires')['breakdown']['patente']['annual']);
        $this->assertSame(0, $this->patente(['price_ars' => 20600000, 'anio' => 2001], 'Buenos Aires')['monthly']['patente']);
        $this->assertGreaterThan(0, $this->patente(['price_ars' => 20600000, 'anio' => 2002], 'Buenos Aires')['monthly']['patente']);
    }

    public function test_misiones_reference_case_and_rules(): void
    {
        // 2% x 14.021.500 = 280.430 a year = 23.369,2 a month -> 24.000.
        $car = $this->patente(['price_ars' => 14021500, 'anio' => 2014], 'Misiones');
        $this->assertSame(24000, $car['monthly']['patente']);

        // Only pickups pay 0,8%; an SUV pays as a car (survey: a 2018 Renegade pays about 2% of its value).
        $pickup = $this->patente(['price_ars' => 20000000, 'anio' => 2022, 'body_type' => 'Pickup'], 'Misiones');
        $this->assertEqualsWithDelta(160000.0, $pickup['breakdown']['patente']['annual'], 0.01);
        $suv = $this->patente(['price_ars' => 25740000, 'anio' => 2018, 'body_type' => 'SUV'], 'Misiones');
        $this->assertEqualsWithDelta(514800.0, $suv['breakdown']['patente']['annual'], 0.01);

        // Older than 20 years (age 21 or more) pays nothing.
        $this->assertSame(0, $this->patente(['price_ars' => 14021500, 'anio' => 2005], 'Misiones')['monthly']['patente']);
        $this->assertGreaterThan(0, $this->patente(['price_ars' => 14021500, 'anio' => 2006], 'Misiones')['monthly']['patente']);
    }

    /** @return array<string, array{0: int, 1: float}> model year (current year 2026), rate */
    public static function santaFeAges(): array
    {
        return ['5 years' => [2021, 0.023], '6 years' => [2020, 0.02], '10 years' => [2016, 0.02], '11 years' => [2015, 0.018]];
    }

    #[DataProvider('santaFeAges')]
    public function test_santa_fe_rate_by_age_of_a_car(int $year, float $rate): void
    {
        $p = $this->patente(['price_ars' => 20000000, 'anio' => $year], 'Santa Fe')['breakdown']['patente'];

        $this->assertEquals($rate, $p['rate']);
    }

    public function test_santa_fe_pickups_and_suvs_pay_two_percent(): void
    {
        foreach (['Pickup', 'SUV'] as $body) {
            $p = $this->patente(['price_ars' => 20000000, 'anio' => 2012, 'body_type' => $body], 'Santa Fe')['breakdown']['patente'];
            $this->assertEquals(0.02, $p['rate']);
        }
    }

    /** @return array<string, array{0: int, 1: float}> value, whole-value rate */
    public static function mendozaBrackets(): array
    {
        return [
            'up to 7.1M' => [7100000, 0.015], 'up to 14.2M' => [14200000, 0.016], 'up to 23.7M' => [23700000, 0.017],
            'up to 35.5M' => [35500000, 0.018], 'up to 47.3M' => [47300000, 0.02], 'up to 59.1M' => [59100000, 0.0225],
            'up to 87.5M' => [87500000, 0.025], 'over 87.5M' => [87500001, 0.03],
        ];
    }

    #[DataProvider('mendozaBrackets')]
    public function test_mendoza_rate_by_bracket(int $value, float $rate): void
    {
        $p = $this->patente(['price_ars' => $value, 'anio' => 2022], 'Mendoza')['breakdown']['patente'];

        $this->assertSame('bracket_rate', $p['method']);
        $this->assertEquals($rate, $p['rate']);
    }

    /** @return array<string, array{0: string, 1: float}> province, flat rate (UADE 2026 and the middle of the range) */
    public static function flatRates(): array
    {
        return [
            'Río Negro' => ['Río Negro', 0.035], 'Chubut' => ['Chubut', 0.027], 'Corrientes' => ['Corrientes', 0.025],
            'La Rioja' => ['La Rioja', 0.025], 'Tierra del Fuego' => ['Tierra del Fuego', 0.025], 'Catamarca' => ['Catamarca', 0.02],
            'Formosa' => ['Formosa', 0.02], 'Jujuy' => ['Jujuy', 0.02], 'Neuquén' => ['Neuquén', 0.02], 'Salta' => ['Salta', 0.02],
            'San Juan' => ['San Juan', 0.02], 'Tucumán' => ['Tucumán', 0.02], 'Entre Ríos' => ['Entre Ríos', 0.034],
            'San Luis' => ['San Luis', 0.036], 'La Pampa' => ['La Pampa', 0.025],
        ];
    }

    #[DataProvider('flatRates')]
    public function test_flat_rate_provinces(string $province, float $rate): void
    {
        $p = $this->patente(['price_ars' => 20000000, 'anio' => 2022], $province)['breakdown']['patente'];

        $this->assertSame('flat', $p['method']);
        $this->assertEquals($rate, $p['rate']);
    }

    public function test_neuquen_exempts_from_20_years(): void
    {
        $this->assertSame(0, $this->patente(['price_ars' => 20000000, 'anio' => 2006], 'Neuquén')['monthly']['patente']);
        $this->assertGreaterThan(0, $this->patente(['price_ars' => 20000000, 'anio' => 2007], 'Neuquén')['monthly']['patente']);
    }

    public function test_an_unknown_province_takes_the_median_of_the_flat_rates(): void
    {
        $flat = (array) config('calculadora.patente.flat_rate');
        $rates = array_values($flat);
        sort($rates);
        $count = count($rates);
        $median = $count % 2 === 1 ? $rates[intdiv($count, 2)] : ($rates[$count / 2 - 1] + $rates[$count / 2]) / 2;

        $p = $this->patente(['price_ars' => 20000000, 'anio' => 2022], 'Atlántida')['breakdown']['patente'];

        $this->assertFalse($p['province_known']);
        $this->assertEquals($median, $p['rate']);
        $this->assertLessThan(max($rates), $p['rate']);
    }

    public function test_cordoba_is_unchanged(): void
    {
        $p = $this->patente(['price_ars' => 20000000, 'anio' => 2022], 'Córdoba')['breakdown']['patente'];

        $this->assertSame('bracket_rate', $p['method']);
        $this->assertEquals(0.025, $p['rate']);
    }

    public function test_every_patente_province_keeps_a_rule_or_a_rate(): void
    {
        $patente = (array) config('calculadora.patente');
        foreach (array_keys((array) $patente['rules']) as $province) {
            $known = isset($patente['scale'][$province]) || isset($patente['bracket_rate'][$province]) || isset($patente['body_rate'][$province])
                || isset($patente['age_rate'][$province]) || isset($patente['flat_rate'][$province]);
            $this->assertTrue($known, "rules for {$province} without a rate scheme");
        }
    }
}
