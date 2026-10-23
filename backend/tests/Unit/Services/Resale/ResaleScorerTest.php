<?php

namespace Tests\Unit\Services\Resale;

use App\Models\Vehiculo;
use App\Services\Resale\ResaleScorer;
use PHPUnit\Framework\TestCase;

class ResaleScorerTest extends TestCase
{
    private function scores(array $rowChanges = [], array $activityChanges = [], array $carChanges = [], bool $duplicate = false): array
    {
        $row = array_replace(['make' => 'Test', 'model' => 'Example', 'version' => 'Base',
            'version_id' => 'generation:1', 'currency' => 'USD', 'values' => [2025 => 100, 2022 => 80]], $rowChanges);
        $car = new Vehiculo(array_replace(['marca' => 'Tést', 'modelo' => 'Example', 'version' => 'BASE', 'anio' => 2025], $carChanges));
        $car->id = 1;
        $prices = ['snapshot' => ['snapshot_id' => 'acara:1', 'source_date' => '2026-10-19',
            'rows' => $duplicate ? [$row, $row] : [$row]], 'stale' => true];
        $activity = array_replace(['make' => 'test', 'model' => 'example', 'special' => [], 'score' => 60], $activityChanges);
        $transfers = ['snapshot' => ['activity' => ['models' => [$activity],
            'window_start' => '2026-04', 'window_end' => '2026-09']], 'stale' => false];

        return (new ResaleScorer)->scores([$car], $prices, $transfers)[1];
    }

    public function test_hu05_exact_identity_three_year_horizon_and_dated_last_valid_evidence(): void
    {
        $row = $this->scores();
        $this->assertSame(70.0, $row['score']);
        $this->assertSame(80.0, $row['retention_score']);
        $this->assertSame('generation:1', $row['comparison']['version_id']);
        $this->assertSame('USD', $row['comparison']['currency']);
        $this->assertSame('acara:1', $row['comparison']['snapshot_id']);
        $this->assertSame(3, $row['comparison']['years']);
        $this->assertSame('2026-09', $row['window_end']);
        $this->assertTrue($row['stale']);
        $above = $this->scores(['values' => [2025 => 100, 2022 => 120]]);
        $this->assertSame(100.0, $above['retention_score']);
        $this->assertSame(120.0, $above['comparison']['retained_percent']);
    }

    public function test_hu05_missing_ambiguous_or_different_generation_is_not_invented(): void
    {
        foreach ([['version' => 'Base L20'],
            ['values' => [2025 => 100, 2022 => null]]] as $changes) {
            $this->assertNull($this->scores($changes)['score']);
        }
        $this->assertNull($this->scores(duplicate: true)['score']);
        $this->assertNull($this->scores(carChanges: ['version' => null])['score']);
        $this->assertNull($this->scores(activityChanges: ['special' => ['gti']])['score']);
        $this->assertSame(70.0, $this->scores(['version' => 'GTI'], ['special' => ['gti']], ['version' => 'GTI'])['score']);
        $car = new Vehiculo(['marca' => 'Test', 'modelo' => 'Example', 'anio' => 2025]);
        $this->assertNull((new ResaleScorer)->scores([$car], ['snapshot' => null, 'stale' => false],
            ['snapshot' => null, 'stale' => false])[$car->id]['score']);
    }

    public function test_two_year_evidence_produces_an_explicit_estimate_not_an_observed_three_year_pair(): void
    {
        $row = $this->scores(['values' => [2025 => 100, 2023 => 81]]);
        $this->assertEqualsWithDelta(72.9, $row['retention_score'], 1e-10);
        $this->assertEqualsWithDelta(66.45, $row['score'], 1e-10);
        $this->assertSame([2023, 2025], $row['estimate']['years_used']);
        $this->assertEqualsWithDelta(10, $row['estimate']['annual_depreciation_percent'], 1e-10);
        $this->assertNull($row['comparison']);
        foreach ([null, 0, -1, INF] as $invalid) {
            $this->assertSame([2023, 2024], $this->scores(['values' => [2025 => $invalid, 2024 => 100, 2023 => 81]])['estimate']['years_used']);
        }
    }
}
