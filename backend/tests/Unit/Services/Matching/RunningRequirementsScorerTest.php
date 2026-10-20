<?php

namespace Tests\Unit\Services\Matching;

use App\Models\Vehiculo;
use App\Services\Matching\RunningRequirementsScorer;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class RunningRequirementsScorerTest extends TestCase
{
    private function vehicle(array $overrides = []): Vehiculo
    {
        return new Vehiculo(array_replace([
            'anio' => 2026, 'kilometraje' => 0, 'combustible' => 'nafta',
            'turbo' => false, 'transmision' => 'manual', 'potencia' => 100,
            'consumo_urbano' => '6.00', 'consumo_ruta' => '12.00',
        ], $overrides));
    }

    #[DataProvider('consumptionBands')]
    public function test_consumption_band_boundaries(string $litres, int $expected): void
    {
        foreach (['nafta', 'diesel'] as $fuel) {
            $vehicle = $this->vehicle(['combustible' => $fuel, 'consumo_urbano' => $litres]);
            $this->assertSame($expected, (new RunningRequirementsScorer)->consumptionScore($vehicle, 'ciudad'));
        }
    }

    public static function consumptionBands(): array
    {
        return [
            ['0.01', 100], ['6.00', 100], ['6.01', 80], ['8.00', 80],
            ['8.01', 60], ['10.00', 60], ['10.01', 40], ['12.00', 40],
            ['12.01', 20], ['20.00', 20],
        ];
    }

    #[DataProvider('uses')]
    public function test_usage_selects_physical_consumption_before_scoring(string $use, int $expected): void
    {
        // Mean of 6 and 12 is 9 => 60, not mean of their scores (100 + 40) / 2 = 70.
        $this->assertSame($expected, (new RunningRequirementsScorer)->consumptionScore($this->vehicle(), $use));
    }

    public static function uses(): array
    {
        return [['ciudad', 100], ['ruta', 40], ['mixto', 60], ['trabajo', 60]];
    }

    public function test_gnc_uses_product_override_without_litre_readings(): void
    {
        $vehicle = $this->vehicle(['combustible' => 'gnc', 'consumo_urbano' => null, 'consumo_ruta' => null]);
        foreach (array_column(self::uses(), 0) as $use) {
            $this->assertSame(100, (new RunningRequirementsScorer)->consumptionScore($vehicle, $use));
        }
    }

    public function test_consumption_requires_only_the_selected_readings(): void
    {
        $scorer = new RunningRequirementsScorer;
        $vehicle = $this->vehicle(['consumo_ruta' => null]);
        $this->assertSame(100, $scorer->consumptionScore($vehicle, 'ciudad'));
        foreach (['ruta', 'mixto', 'trabajo'] as $use) {
            $this->assertNull($scorer->consumptionScore($vehicle, $use));
        }
        $vehicle = $this->vehicle(['consumo_urbano' => null]);
        $this->assertSame(40, $scorer->consumptionScore($vehicle, 'ruta'));
        foreach (['ciudad', 'mixto', 'trabajo'] as $use) {
            $this->assertNull($scorer->consumptionScore($vehicle, $use));
        }
        foreach ([0, -1] as $invalid) {
            $this->assertNull($scorer->consumptionScore($this->vehicle(['consumo_urbano' => $invalid]), 'ciudad'));
        }
        $this->assertNull($scorer->consumptionScore($this->vehicle(['combustible' => 'gnc']), 'unknown'));
    }

    #[DataProvider('ageBands')]
    public function test_age_boundaries(int $age, float $expected): void
    {
        $score = (new RunningRequirementsScorer)->maintenanceScore($this->vehicle(['anio' => 2026 - $age]), 2026);
        $this->assertEqualsWithDelta($expected, $score, 0.000001);
    }

    public static function ageBands(): array
    {
        return [
            [-1, 100], [0, 100], [3, 100], [4, 90.625], [7, 90.625],
            [8, 81.25], [12, 81.25], [13, 71.875], [20, 71.875], [21, 62.5],
        ];
    }

    #[DataProvider('odometerBands')]
    public function test_odometer_boundaries(int $kilometres, float $expected): void
    {
        $score = (new RunningRequirementsScorer)->maintenanceScore($this->vehicle(['kilometraje' => $kilometres]), 2026);
        $this->assertEqualsWithDelta($expected, $score, 0.000001);
    }

    public static function odometerBands(): array
    {
        return [
            [0, 100], [40000, 100], [40001, 90.625], [80000, 90.625],
            [80001, 81.25], [140000, 81.25], [140001, 71.875], [200000, 71.875], [200001, 62.5],
        ];
    }

    #[DataProvider('engines')]
    public function test_fuel_and_turbo_adjustments_are_additive(string $fuel, bool $turbo, float $expected): void
    {
        $vehicle = $this->vehicle(['combustible' => $fuel, 'turbo' => $turbo]);
        $this->assertEqualsWithDelta($expected, (new RunningRequirementsScorer)->maintenanceScore($vehicle, 2026), 0.000001);
    }

    public static function engines(): array
    {
        return [
            ['nafta', false, 100], ['nafta', true, 96.25],
            ['diesel', false, 96.25], ['diesel', true, 92.5],
            ['gnc', false, 98.5], ['gnc', true, 94.75],
        ];
    }

    public function test_transmission_and_weighted_composition_keep_fractional_points(): void
    {
        $scorer = new RunningRequirementsScorer;
        $this->assertEqualsWithDelta(97.5, $scorer->maintenanceScore($this->vehicle(['transmision' => 'automatica']), 2026), 0.000001);
        $vehicle = $this->vehicle([
            'anio' => 2016, 'kilometraje' => 150000, 'combustible' => 'diesel',
            'turbo' => true, 'transmision' => 'automatica',
        ]);
        $this->assertEqualsWithDelta(43.125, $scorer->maintenanceScore($vehicle, 2026), 0.000001);
        $vehicle->anio = 2000;
        $vehicle->kilometraje = 250000;
        $this->assertEqualsWithDelta(15, $scorer->maintenanceScore($vehicle, 2026), 0.000001);
    }

    public function test_year_is_explicit_and_power_does_not_affect_maintenance(): void
    {
        $scorer = new RunningRequirementsScorer;
        $vehicle = $this->vehicle(['anio' => 2023]);
        $this->assertEqualsWithDelta(100, $scorer->maintenanceScore($vehicle, 2026), 0.000001);
        $this->assertEqualsWithDelta(90.625, $scorer->maintenanceScore($vehicle, 2030), 0.000001);
        foreach ([50, 500, null] as $power) {
            $vehicle->potencia = $power;
            $this->assertEqualsWithDelta(100, $scorer->maintenanceScore($vehicle, 2026), 0.000001);
        }
    }

    public function test_missing_maintenance_facts_and_unsupported_fuels_are_not_zero_scores(): void
    {
        $scorer = new RunningRequirementsScorer;
        foreach (['anio', 'kilometraje', 'turbo', 'transmision', 'combustible'] as $field) {
            $this->assertNull($scorer->maintenanceScore($this->vehicle([$field => null]), 2026));
        }
        foreach (['hibrido', 'electrico', null, 'unknown'] as $fuel) {
            $vehicle = $this->vehicle(['combustible' => $fuel]);
            $this->assertNull($scorer->consumptionScore($vehicle, 'ciudad'));
            $this->assertNull($scorer->maintenanceScore($vehicle, 2026));
        }
        $this->assertNull($scorer->maintenanceScore($this->vehicle(['transmision' => 'unknown']), 2026));
        $this->assertNull($scorer->maintenanceScore($this->vehicle(['kilometraje' => -1]), 2026));
    }

    public function test_scoring_does_not_mutate_vehicle_facts(): void
    {
        $vehicle = $this->vehicle();
        $before = $vehicle->getAttributes();
        $scorer = new RunningRequirementsScorer;
        $scorer->consumptionScore($vehicle, 'mixto');
        $scorer->maintenanceScore($vehicle, 2026);
        $this->assertSame($before, $vehicle->getAttributes());
    }
}
