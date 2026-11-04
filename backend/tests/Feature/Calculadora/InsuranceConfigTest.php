<?php

namespace Tests\Feature\Calculadora;

use App\Services\Calculadora\OwnershipCostCalculator;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The central insurance model as it is written in config/calculadora.php (not as a test double): each case is computed
 * by hand from the survey cars, so a mistyped floor, rate or zone factor in the config fails here.
 */
class InsuranceConfigTest extends TestCase
{
    /** @param  array<string, mixed>  $vehicle */
    private function estimate(array $vehicle, string $province, string $coverage = 'terceros_completo'): array
    {
        $vehicle += ['marca' => 'Renault', 'modelo' => 'Sandero', 'body_type' => 'Sedán', 'fuel' => 'nafta', 'consumo_urbano' => 8, 'consumo_ruta' => 6, 'anio' => 2022];

        return (new OwnershipCostCalculator)->calculate($vehicle, $province, 1500, $coverage, (array) config('calculadora'), 2026);
    }

    public function test_the_config_states_the_central_model(): void
    {
        $insurance = (array) config('calculadora.insurance');

        $this->assertSame(46000, $insurance['tc_floor']);
        $this->assertSame(0.0037, $insurance['tc_value_rate']);
        $this->assertSame(1.5, $insurance['tr_ratio']);
        $this->assertSame(
            ['caba' => 1.0, 'buenos_aires' => 1.0, 'cordoba' => 0.8, 'santa_fe' => 0.8, 'mendoza' => 0.72, 'default' => 0.7],
            $insurance['zone_factor'],
        );
        $this->assertSame('2026-10', $insurance['cpi_base_month']);
        $this->assertArrayNotHasKey('tc_base', $insurance);
    }

    /** @return array<string, array{0: int, 1: string, 2: string, 3: int}> price, province, coverage, expected */
    public static function surveyCars(): array
    {
        return [
            // 46.000 + 20.641.300 x 0,0037 = 122.372,8.
            'Yaris in Buenos Aires, terceros completo' => [20641300, 'Buenos Aires', 'terceros_completo', 123000],
            // TC 190.246,7 -> 191.000; x 1,5 = 286.500.
            'Taos in CABA, todo riesgo' => [38985600, 'CABA', 'todo_riesgo', 287000],
            'Taos in CABA, terceros completo' => [38985600, 'CABA', 'terceros_completo', 191000],
            // (46.000 + 51.879,6) x 0,70 = 68.515,7: Misiones is outside the zone map.
            'Etios in Misiones, terceros completo' => [14021500, 'Misiones', 'terceros_completo', 69000],
        ];
    }

    #[DataProvider('surveyCars')]
    public function test_the_survey_cars(int $price, string $province, string $coverage, int $expected): void
    {
        $this->assertSame($expected, $this->estimate(['price_ars' => $price], $province, $coverage)['monthly']['insurance']);
    }

    public function test_the_body_type_does_not_change_the_amount(): void
    {
        $sedan = $this->estimate(['price_ars' => 20641300, 'body_type' => 'Sedán'], 'Buenos Aires');
        $pickup = $this->estimate(['price_ars' => 20641300, 'body_type' => 'Pickup'], 'Buenos Aires');

        $this->assertSame(123000, $sedan['monthly']['insurance']);
        $this->assertSame(123000, $pickup['monthly']['insurance']);
    }
}
