<?php

namespace App\Services\Portales;

/**
 * Decides which model years of each curated model a buyer can afford, from ACARA year ranges. Pure.
 */
final class ModelBudgetFit
{
    /** Model years considered when the buyer has a budget. */
    private const WINDOW = 10;

    /** Model years considered when there is no cap: only the newest ones. */
    private const WINDOW_WITHOUT_CAP = 5;

    /**
     * @return list<int> Model years to read, oldest first.
     */
    public static function years(?int $budget, int $currentYear): array
    {
        $count = $budget === null ? self::WINDOW_WITHOUT_CAP : self::WINDOW;

        return range($currentYear - $count + 1, $currentYear);
    }

    /**
     * A year fits when its cheapest version is within the budget (always, without a cap). USD rows are
     * converted with the rate and cannot fit without one.
     *
     * @param  iterable<object{modelo_id: int, year: string, currency: string, min_amount: string|float, max_amount: string|float}>  $rows
     * @return array<int, ModelFit> Models with at least one fitting year, by model id.
     */
    public function fit(iterable $rows, ?int $budget, ?float $usdRate, int $currentYear): array
    {
        $window = array_flip(array_map('strval', self::years($budget, $currentYear)));
        $perYear = [];
        $usedUsd = [];
        foreach ($rows as $row) {
            $year = (string) $row->year;
            if (! isset($window[$year])) {
                continue;
            }
            $factor = $row->currency === 'USD' ? $usdRate : 1.0;
            if ($factor === null) {
                continue;
            }
            $id = (int) $row->modelo_id;
            $min = (float) $row->min_amount * $factor;
            $max = (float) $row->max_amount * $factor;
            $range = $perYear[$id][(int) $year] ?? [$min, $max];
            $perYear[$id][(int) $year] = [min($range[0], $min), max($range[1], $max)];
            $usedUsd[$id] = ($usedUsd[$id] ?? false) || $row->currency === 'USD';
        }

        $fits = [];
        foreach ($perYear as $id => $years) {
            ksort($years);
            $fitting = array_keys(array_filter($years, fn (array $range) => $budget === null || $range[0] <= $budget));
            if ($fitting === []) {
                continue;
            }
            $reference = max($fitting);
            $fits[$id] = new ModelFit($id, $fitting, $reference,
                (int) round($years[$reference][0]), (int) round($years[$reference][1]), $usedUsd[$id]);
        }

        return $fits;
    }
}
