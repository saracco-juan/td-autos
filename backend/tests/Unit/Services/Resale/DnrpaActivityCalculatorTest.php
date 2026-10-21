<?php

namespace Tests\Unit\Services\Resale;

use App\Services\Resale\DnrpaActivityCalculator;
use App\Services\Resale\DnrpaActivityReader;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class DnrpaActivityCalculatorTest extends TestCase
{
    private function month(string $month, array $counts = [5, 4, 3, 2, 1]): array
    {
        $models = [];
        foreach ($counts as $index => $count) {
            $models[] = ['make' => 'test', 'model' => 'model '.$index, 'special' => [], 'transfers' => $count];
        }

        return ['source' => 'DNRPA', 'month' => $month, 'catalog_snapshot_id' => 'acara:test',
            'transfers' => array_sum($counts) + 2, 'identified' => array_sum($counts),
            'unmatched' => 2, 'models' => $models];
    }

    private function history(array $counts = [5, 4, 3, 2, 1]): array
    {
        return array_map(fn ($month) => $this->month($month, $counts),
            ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    }

    private function calculate(array $history): ?array
    {
        return (new DnrpaActivityCalculator)->calculate($history, new DateTimeImmutable('2026-10-21'));
    }

    public function test_hu05_sums_six_months_and_assigns_the_five_relative_activity_bands(): void
    {
        $result = $this->calculate($this->history());

        $this->assertSame('2026-04', $result['window_start']);
        $this->assertSame('2026-09', $result['window_end']);
        $this->assertSame('acara:test', $result['catalog_snapshot_id']);
        $this->assertSame(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'], $result['months']);
        $this->assertSame([102, 90, 12], [$result['transfers'], $result['identified'], $result['unmatched']]);
        $this->assertSame([30, 24, 18, 12, 6], array_column($result['models'], 'transfers'));
        $this->assertSame([100, 80, 60, 40, 20], array_column($result['models'], 'score'));
    }

    public function test_selects_the_latest_available_closed_window_and_preserves_inputs(): void
    {
        $history = [$this->month('2026-03'), ...$this->history(), $this->month('2026-10'), $this->month('2026-11')];
        $before = $history;
        $expected = $this->calculate($this->history());

        $this->assertSame($expected, $this->calculate(array_reverse($history)));
        $this->assertSame($before, $history);
        $this->assertNull($this->calculate([]));
    }

    public function test_calendar_selection_crosses_years_and_rejects_incomplete_months(): void
    {
        $calculator = new DnrpaActivityCalculator;

        $this->assertSame(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'],
            $calculator->monthsEndingAt('2026-02', new DateTimeImmutable('2026-03-01')));
        foreach (['2026-03', '2026-04', '2026-13', '2026-2'] as $month) {
            $this->assertNull($calculator->monthsEndingAt($month, new DateTimeImmutable('2026-03-01')));
        }
        $history = array_map(fn ($month) => $this->month($month),
            ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
        $this->assertSame('2025-09', $calculator->calculate($history, new DateTimeImmutable('2026-03-01'))['window_start']);
    }

    #[DataProvider('populations')]
    public function test_ties_and_small_populations_do_not_split_equal_activity(array $counts, array $scores): void
    {
        $this->assertSame($scores, array_column($this->calculate($this->history($counts))['models'], 'score'));
    }

    public static function populations(): array
    {
        return [[[1], [100]], [[2, 1], [100, 20]], [[3, 2, 1], [100, 60, 20]],
            [[4, 3, 2, 1], [100, 80, 40, 20]], [[2, 2, 1], [100, 100, 20]],
            [[1, 1, 1], [100, 100, 100]], [[6, 5, 4, 3, 2, 1], [100, 80, 60, 40, 20, 20]]];
    }

    public function test_special_variants_remain_separate_and_unknowns_receive_no_model_score(): void
    {
        $history = $this->history([2, 1]);
        foreach ($history as &$month) {
            $month['models'][1]['model'] = $month['models'][0]['model'];
            $month['models'][1]['special'] = ['gti'];
        }
        $models = $this->calculate($history)['models'];
        $this->assertSame([[], ['gti']], array_column($models, 'special'));
        $this->assertSame([12, 6], array_column($models, 'transfers'));
        $unknown = $this->calculate($this->history([]));
        $this->assertSame([], $unknown['models']);
        $this->assertSame([12, 0, 12], [$unknown['transfers'], $unknown['identified'], $unknown['unmatched']]);
    }

    public function test_uses_the_existing_monthly_reader_contract_without_inventing_versions(): void
    {
        $catalog = ['snapshot_id' => 'acara:test', 'rows' => [
            ['make' => 'Volkswagen', 'model' => 'Golf', 'version' => 'GTI'],
        ]];
        $history = [];
        foreach (['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'] as $month) {
            $stream = fopen('php://memory', 'w+');
            fwrite($stream, "tramite_fecha,automotor_marca_descripcion,automotor_modelo_descripcion\n$month-15,Volkswagen,Golf GTI\n");
            rewind($stream);
            try {
                $history[] = (new DnrpaActivityReader)->read($stream, $month, $catalog);
            } finally {
                fclose($stream);
            }
        }
        $model = $this->calculate($history)['models'][0];
        $this->assertSame(['make' => 'volkswagen', 'model' => 'golf', 'special' => ['gti'], 'transfers' => 6, 'score' => 100], $model);
    }

    #[DataProvider('invalidSnapshots')]
    public function test_incomplete_or_inconsistent_evidence_is_unavailable(string $case): void
    {
        $history = $this->history();
        switch ($case) {
            case 'gap': array_splice($history, 2, 1);
                break;
            case 'duplicate month': $history[] = $history[0];
                break;
            case 'mixed catalogs': $history[0]['catalog_snapshot_id'] = 'other';
                break;
            case 'invalid month': $history[0]['month'] = '2026-13';
                break;
            case 'coverage': $history[0]['unmatched']++;
                break;
            case 'duplicate model': $history[0]['models'][] = $history[0]['models'][0];
                break;
            case 'fractional count': $history[0]['models'][0]['transfers'] = 1.5;
                break;
            case 'zero count': $history[0]['models'][0]['transfers'] = 0;
                break;
            case 'blank identity': $history[0]['models'][0]['model'] = '';
                break;
            case 'unidentified marker': $history[0]['models'][0]['special'] = ['tdi'];
                break;
            case 'missing provenance': unset($history[0]['catalog_snapshot_id']);
                break;
            case 'missing model counts': $history[0]['models'] = [];
                break;
            case 'wrong source': $history[0]['source'] = 'other';
                break;
        }
        $before = $history;

        $this->assertNull($this->calculate($history));
        $this->assertSame($before, $history);
    }

    public static function invalidSnapshots(): array
    {
        return array_map(fn ($case) => [$case], ['gap', 'duplicate month', 'mixed catalogs', 'invalid month',
            'coverage', 'duplicate model', 'fractional count', 'zero count', 'blank identity',
            'unidentified marker', 'missing provenance', 'missing model counts', 'wrong source']);
    }
}
