<?php

namespace Tests\Unit\Services\Resale;

use App\Services\Resale\DepreciationProjection;
use App\Services\Resale\ValueRetentionCalculator;
use PHPUnit\Framework\TestCase;

class DepreciationProjectionTest extends TestCase
{
    public function test_tc40_projects_the_published_price_using_the_hu05_annual_rate(): void
    {
        $estimate = (new ValueRetentionCalculator)->estimate([
            'snapshot_id' => 'acara:2026-10-19', 'version_id' => 'corolla',
            'currency' => 'ARS', 'values' => [2020 => 8100, 2021 => 9000, 2022 => 10000],
        ]);
        $before = $estimate;
        $result = (new DepreciationProjection)->calculate(20000, 'USD', $estimate);

        $this->assertSame(20000.0, $result['current_value']);
        $this->assertSame('USD', $result['currency']);
        $this->assertEqualsWithDelta(10, $result['annual_depreciation_percent'], 1e-10);
        $this->assertSame([1, 3, 5], array_column($result['points'], 'years'));
        $this->assertEquals([18000, 14580, 11809.8], array_column($result['points'], 'value'));
        $this->assertEquals([90, 72.9, 59.049], array_column($result['points'], 'retained_percent'));
        $this->assertSame($before, $estimate);
    }

    public function test_appreciation_is_not_capped_by_the_hu05_ranking_score(): void
    {
        $result = (new DepreciationProjection)->calculate(100, 'ARS', [
            'annual_retained_percent' => 110, 'annual_depreciation_percent' => -10, 'score' => 100,
        ]);
        $this->assertSame(-10.0, $result['annual_depreciation_percent']);
        $this->assertSame(161.05, $result['points'][2]['value']);
        $this->assertEqualsWithDelta(161.051, $result['points'][2]['retained_percent'], 1e-9);
    }

    public function test_tc41_rejects_missing_or_invalid_inputs_without_fabricating_values(): void
    {
        $projection = new DepreciationProjection;
        $estimate = ['annual_retained_percent' => 90, 'annual_depreciation_percent' => 10];
        foreach ([null, 0, -1, INF, NAN] as $price) {
            $this->assertNull($projection->calculate($price, 'ARS', $estimate));
        }
        foreach ([null, 'EUR'] as $currency) {
            $this->assertNull($projection->calculate(100, $currency, $estimate));
        }
        foreach ([null, [], ['annual_retained_percent' => 0],
            ['annual_retained_percent' => INF], ['annual_retained_percent' => 1e100]] as $invalid) {
            $this->assertNull($projection->calculate(100, 'ARS', $invalid));
        }
    }
}
