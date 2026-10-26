<?php

namespace App\Services\Resale;

/** Same-date model-year references, not observed history or future sale prices. */
final class ValueRetentionCalculator
{
    /** Complete-link price similarity: every pair must overlap and stay within 5%, never chain. */
    public function estimateGroup(array $rows, string $snapshot): ?array
    {
        $estimates = [];
        foreach ($rows as $i => $row) {
            foreach (array_slice($rows, 0, $i) as $other) {
                foreach (['make', 'model', 'currency', '_technical'] as $key) {
                    if (($row[$key] ?? null) !== ($other[$key] ?? null)) {
                        return null;
                    }
                }
                $overlap = 0;
                foreach ($row['values'] as $year => $price) {
                    $peer = $other['values'][$year] ?? null;
                    if (is_numeric($price) && is_numeric($peer) && is_finite((float) $price)
                        && is_finite((float) $peer) && $price > 0 && $peer > 0) {
                        $overlap++;
                        if (max($price, $peer) / min($price, $peer) > 1.05 + 1e-12) {
                            return null;
                        }
                    }
                }
                if ($overlap === 0) {
                    return null;
                }
            }
            $estimate = $this->estimate($row + ['snapshot_id' => $snapshot]);
            if ($estimate === null || isset($estimates[$row['version_id']])) {
                return null;
            }
            $estimates[$row['version_id']] = $estimate;
        }
        if (count($estimates) <= 1) {
            return $estimates === [] ? null : reset($estimates);
        }
        $rates = array_map(fn ($e) => log($e['annual_retained_percent'] / 100), array_values($estimates));
        sort($rates, SORT_NUMERIC);
        $middle = intdiv(count($rates), 2);
        $rate = count($rates) % 2 ? $rates[$middle] : ($rates[$middle - 1] + $rates[$middle]) / 2;
        $retained = round(100 * exp(3 * $rate), 12);
        $years = array_values(array_unique(array_merge(...array_column($estimates, 'years_used'))));
        sort($years);

        return array_replace(reset($estimates), ['version_id' => null, 'reference_count' => count($estimates),
            'curves' => array_values($estimates), 'years_used' => $years, 'interval_count' => array_sum(array_column($estimates, 'interval_count')),
            'annual_retained_percent' => 100 * exp($rate), 'annual_depreciation_percent' => 100 - 100 * exp($rate),
            'retained_percent' => $retained, 'score' => min(100.0, $retained),
            'retention_range' => [min(array_column($estimates, 'retained_percent')), max(array_column($estimates, 'retained_percent'))]]);
    }

    /** Median adjacent log-retention rate on one curve; the horizon is modeled, not observed. */
    public function estimate(array $curve): ?array
    {
        $points = [];
        foreach ($curve['values'] ?? [] as $year => $price) {
            if (! is_numeric($year) || (float) $year !== (float) (int) $year || $year < 1900 || $year > 2100) {
                continue;
            }
            $point = ['snapshot_id' => $curve['snapshot_id'] ?? null, 'version_id' => $curve['version_id'] ?? null,
                'currency' => $curve['currency'] ?? null, 'model_year' => (int) $year, 'price' => $price];
            if ($this->validPoint($point)) {
                $points[(int) $year] = (float) $price;
            }
        }
        ksort($points, SORT_NUMERIC);
        if (count($points) < 2) {
            return null;
        }
        $rates = [];
        $years = array_keys($points);
        for ($i = 1; $i < count($years); $i++) {
            [$older, $newer] = [$years[$i - 1], $years[$i]];
            $rates[] = (log($points[$older]) - log($points[$newer])) / ($newer - $older);
        }
        sort($rates, SORT_NUMERIC);
        $middle = intdiv(count($rates), 2);
        $logRate = count($rates) % 2 ? $rates[$middle] : ($rates[$middle - 1] + $rates[$middle]) / 2;
        $annual = exp($logRate) * 100;
        $retained = exp(3 * $logRate) * 100;
        if (! is_finite($annual) || ! is_finite($retained) || $annual <= 0 || $retained <= 0) {
            return null;
        }

        return ['method' => 'annualized', 'horizon_years' => 3,
            'annual_retained_percent' => $annual, 'annual_depreciation_percent' => round(100 - $annual, 12),
            'retained_percent' => $retained, 'score' => min(100.0, round($retained, 12)),
            'years_used' => $years, 'interval_count' => count($rates),
            'snapshot_id' => $curve['snapshot_id'], 'version_id' => $curve['version_id'], 'currency' => $curve['currency']];
    }

    /** Fixed HU05 horizon; missing evidence is not a zero score. */
    public function threeYearScore(array $reference, array $older): ?float
    {
        $comparison = $this->compare($reference, $older);
        if ($comparison === null || $comparison['years'] !== 3) {
            return null;
        }

        return min(100.0, $comparison['retained_percent']);
    }

    /**
     * Compare normalized points from one exact-version reference curve.
     * Each point carries snapshot_id, version_id (including generation), currency,
     * model_year (integer, never the 0km column), and price (positive numeric value).
     * A one-year pair gives annual depreciation; a longer pair gives cumulative loss.
     * Missing intermediate years require no interpolation for a known endpoint pair.
     */
    public function compare(array $reference, array $older): ?array
    {
        if (! $this->validPoint($reference) || ! $this->validPoint($older)
            || $older['model_year'] >= $reference['model_year']) {
            return null;
        }

        foreach (['snapshot_id', 'version_id', 'currency'] as $identity) {
            if ($reference[$identity] !== $older[$identity]) {
                return null;
            }
        }

        $referenceValue = (float) $reference['price'];
        $olderValue = (float) $older['price'];
        $retained = $olderValue / $referenceValue * 100;
        if (! is_finite($retained)) {
            return null;
        }

        // Preserve raw appreciation and precision; only the matching score is capped.
        return [
            'snapshot_id' => $reference['snapshot_id'],
            'version_id' => $reference['version_id'],
            'currency' => $reference['currency'],
            'from_year' => $reference['model_year'],
            'to_year' => $older['model_year'],
            'years' => $reference['model_year'] - $older['model_year'],
            'reference_value' => $referenceValue,
            'older_value' => $olderValue,
            'retained_percent' => $retained,
            'depreciation_percent' => 100 - $retained,
        ];
    }

    private function validPoint(array $point): bool
    {
        foreach (['snapshot_id', 'version_id'] as $identity) {
            if (! is_string($point[$identity] ?? null) || trim($point[$identity]) === '') {
                return false;
            }
        }

        return in_array($point['currency'] ?? null, ['ARS', 'USD'], true)
            && is_int($point['model_year'] ?? null)
            && $point['model_year'] > 0
            && is_numeric($point['price'] ?? null)
            && is_finite((float) $point['price'])
            && (float) $point['price'] > 0;
    }
}
