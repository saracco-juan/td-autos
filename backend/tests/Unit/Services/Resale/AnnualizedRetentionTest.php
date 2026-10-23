<?php

namespace Tests\Unit\Services\Resale;

use App\Services\Resale\ValueRetentionCalculator;
use PHPUnit\Framework\TestCase;

class AnnualizedRetentionTest extends TestCase
{
    private function estimate(array $values, array $changes = []): ?array
    {
        return (new ValueRetentionCalculator)->estimate(array_replace([
            'snapshot_id' => 'acara:test', 'version_id' => 'version:1', 'currency' => 'ARS',
            'values' => $values,
        ], $changes));
    }

    public function test_variable_year_gaps_use_a_common_modeled_horizon(): void
    {
        foreach ([1, 2, 4] as $gap) {
            $result = $this->estimate([2025 => 100, 2025 - $gap => 100 * 0.9 ** $gap]);
            $this->assertEqualsWithDelta(10, $result['annual_depreciation_percent'], 1e-10);
            $this->assertEqualsWithDelta(72.9, $result['retained_percent'], 1e-10);
            $this->assertSame(3, $result['horizon_years']);
            $this->assertSame('annualized', $result['method']);
            $this->assertSame([2025 - $gap, 2025], $result['years_used']);
        }
    }

    public function test_all_available_intervals_contribute_without_crossing_curve_identity(): void
    {
        $result = $this->estimate([2019 => '29343700', 2018 => '26604300', 2017 => '24340200']);
        $this->assertEqualsWithDelta(8.923856174, $result['annual_depreciation_percent'], 1e-8);
        $this->assertEqualsWithDelta(75.546422433, $result['retained_percent'], 1e-8);
        $this->assertSame(2, $result['interval_count']);
        $this->assertSame('version:1', $result['version_id']);
        $this->assertSame('ARS', $result['currency']);
        $this->assertSame('acara:test', $result['snapshot_id']);
        $this->assertSame($result, $this->estimate([2017 => '24340200', 2018 => '26604300', 2019 => '29343700']));
    }

    public function test_invalid_or_single_points_do_not_manufacture_a_rate(): void
    {
        foreach ([[], [2025 => 100], [2025 => 100, 2024 => null], [2025 => 100, 2024 => 0],
            [2025 => 100, 2024 => -1], [2025 => 100, 2024 => INF], [2025 => 100, 2024 => NAN],
            [2025 => 100, '0km' => 80], [2025 => 100, 2024 => '1.000,00']] as $values) {
            $this->assertNull($this->estimate($values));
        }
        foreach (['snapshot_id' => '', 'version_id' => '', 'currency' => 'EUR'] as $key => $invalid) {
            $this->assertNull($this->estimate([2025 => 100, 2024 => 90], [$key => $invalid]));
        }
    }

    public function test_appreciation_is_preserved_while_only_the_matching_score_is_capped(): void
    {
        $result = $this->estimate([2025 => 100, 2024 => 110]);
        $this->assertEqualsWithDelta(-10, $result['annual_depreciation_percent'], 1e-10);
        $this->assertEqualsWithDelta(133.1, $result['retained_percent'], 1e-10);
        $this->assertSame(100.0, $result['score']);
        $this->assertNull($this->estimate([2025 => PHP_FLOAT_MIN, 2024 => PHP_FLOAT_MAX]));
    }
}
