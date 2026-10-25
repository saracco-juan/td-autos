<?php

namespace Tests\Unit\Services\Resale;

use App\Services\Resale\ValueRetentionCalculator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ValueRetentionCalculatorTest extends TestCase
{
    private function point(array $overrides = []): array
    {
        return array_replace([
            'snapshot_id' => 'acara:2026-10-19',
            'version_id' => 'chevrolet/onix/joy-1.4-mt/L20',
            'currency' => 'ARS', 'model_year' => 2024, 'price' => '19800000.00',
        ], $overrides);
    }

    public function test_hu05_three_year_reference_preserves_raw_arithmetic_and_provenance(): void
    {
        $calculator = new ValueRetentionCalculator;
        $reference = $this->point();
        $older = $this->point(['model_year' => 2021, 'price' => 16976000]);
        $before = [$reference, $older];
        $result = $calculator->compare($reference, $older);

        $this->assertSame('acara:2026-10-19', $result['snapshot_id']);
        $this->assertSame($reference['version_id'], $result['version_id']);
        $this->assertSame('ARS', $result['currency']);
        $this->assertSame(2024, $result['from_year']);
        $this->assertSame(2021, $result['to_year']);
        $this->assertSame(3, $result['years']);
        $this->assertSame(19800000.0, $result['reference_value']);
        $this->assertSame(16976000.0, $result['older_value']);
        $this->assertEqualsWithDelta(85.73737373737373, $result['retained_percent'], 1e-10);
        $this->assertEqualsWithDelta(14.26262626262627, $result['depreciation_percent'], 1e-10);
        $this->assertSame($result['retained_percent'], $calculator->threeYearScore($reference, $older));
        $this->assertSame($before, [$reference, $older]);
    }

    public function test_hu15_adjacent_and_cumulative_comparisons_do_not_assume_a_constant_rate(): void
    {
        $calculator = new ValueRetentionCalculator;
        $newest = $this->point(['price' => 100]);
        $middle = $this->point(['model_year' => 2023, 'price' => 90]);
        $oldest = $this->point(['model_year' => 2022, 'price' => 72]);

        $this->assertEqualsWithDelta(10, $calculator->compare($newest, $middle)['depreciation_percent'], 1e-10);
        $this->assertEqualsWithDelta(20, $calculator->compare($middle, $oldest)['depreciation_percent'], 1e-10);
        $this->assertEqualsWithDelta(28, $calculator->compare($newest, $oldest)['depreciation_percent'], 1e-10);
    }

    public function test_missing_annual_point_does_not_prevent_a_valid_three_year_pair(): void
    {
        $calculator = new ValueRetentionCalculator;
        $reference = $this->point();
        $older = $this->point(['model_year' => 2021, 'price' => 16976000]);

        $this->assertNull($calculator->compare($reference, []));
        $this->assertNull($calculator->compare([], $older));
        $this->assertNotNull($calculator->threeYearScore($reference, $older));
        $this->assertNull($calculator->threeYearScore($reference, []));
    }

    #[DataProvider('nonThreeYearHorizons')]
    public function test_hu05_never_substitutes_another_horizon(int $year): void
    {
        $calculator = new ValueRetentionCalculator;
        $older = $this->point(['model_year' => $year, 'price' => 15000000]);
        $this->assertNotNull($calculator->compare($this->point(), $older));
        $this->assertNull($calculator->threeYearScore($this->point(), $older));
    }

    public static function nonThreeYearHorizons(): array
    {
        return [[2023], [2022], [2020], [2019]];
    }

    #[DataProvider('incomparableEvidence')]
    public function test_mismatched_or_invalid_evidence_is_unavailable(array $changes): void
    {
        $calculator = new ValueRetentionCalculator;
        $reference = $this->point();
        $older = $this->point(array_replace(['model_year' => 2021, 'price' => 16976000], $changes));
        $this->assertNull($calculator->compare($reference, $older));
        $this->assertNull($calculator->threeYearScore($reference, $older));
        $this->assertNull($calculator->compare($this->point($changes), $this->point(['model_year' => 2020])));
    }

    public static function incomparableEvidence(): array
    {
        return [
            'other snapshot' => [['snapshot_id' => 'acara:2026-09-01']],
            'other version' => [['version_id' => 'chevrolet/onix/lt-1.4-mt/L20']],
            'other generation' => [['version_id' => 'chevrolet/onix/joy-1.4-mt/L23']],
            'different currency' => [['currency' => 'USD']],
            'missing snapshot' => [['snapshot_id' => null]],
            'blank snapshot' => [['snapshot_id' => ' ']],
            'missing version' => [['version_id' => null]],
            'blank version' => [['version_id' => '']],
            'unknown currency' => [['currency' => 'EUR']],
            'missing price' => [['price' => null]],
            'formatted price' => [['price' => '19.800.000,00']],
            'zero price' => [['price' => 0]],
            'negative price' => [['price' => -1]],
            'infinite price' => [['price' => INF]],
            'not a number' => [['price' => NAN]],
            'missing year' => [['model_year' => null]],
            'unnormalized year' => [['model_year' => '2021']],
            '0km is not a model year' => [['model_year' => 0]],
        ];
    }

    public function test_equal_or_reversed_years_are_not_an_age_comparison(): void
    {
        $calculator = new ValueRetentionCalculator;
        foreach ([2024, 2025] as $year) {
            $this->assertNull($calculator->compare($this->point(), $this->point(['model_year' => $year])));
        }
    }

    public function test_matching_score_caps_appreciation_without_rewriting_the_reference(): void
    {
        $calculator = new ValueRetentionCalculator;
        $reference = $this->point(['price' => 100, 'currency' => 'USD']);
        $older = $this->point(['model_year' => 2021, 'price' => 110, 'currency' => 'USD']);
        $result = $calculator->compare($reference, $older);

        $this->assertEqualsWithDelta(110, $result['retained_percent'], 1e-10);
        $this->assertEqualsWithDelta(-10, $result['depreciation_percent'], 1e-10);
        $this->assertSame(100.0, $calculator->threeYearScore($reference, $older));
    }

    public function test_non_finite_calculation_is_unavailable(): void
    {
        $calculator = new ValueRetentionCalculator;
        $reference = $this->point(['price' => 0.01]);
        $older = $this->point(['model_year' => 2021, 'price' => PHP_FLOAT_MAX]);
        $this->assertNull($calculator->compare($reference, $older));
        $this->assertNull($calculator->threeYearScore($reference, $older));
    }
}
