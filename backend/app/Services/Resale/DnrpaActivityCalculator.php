<?php

namespace App\Services\Resale;

use DateTimeImmutable;

/** Relative transfer activity from comparable monthly aggregates, never sale probability. */
final class DnrpaActivityCalculator
{
    public function monthsEndingAt(string $latest, DateTimeImmutable $asOf): ?array
    {
        if (! preg_match('/^\d{4}-\d{2}$/D', $latest)) {
            return null;
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m', $latest);
        if (! $date || $date->format('Y-m') !== $latest || $latest >= $asOf->format('Y-m')) {
            return null;
        }

        return array_map(fn ($offset) => $date->modify("-$offset months")->format('Y-m'), range(5, 0));
    }

    /** Missing/inconsistent evidence is unavailable, not six months padded with zeros. */
    public function calculate(array $history, DateTimeImmutable $asOf): ?array
    {
        $indexed = [];
        foreach ($history as $snapshot) {
            $month = $snapshot['month'] ?? null;
            if (! is_string($month) || ! preg_match('/^\d{4}-\d{2}$/D', $month)
                || ! ($date = DateTimeImmutable::createFromFormat('!Y-m', $month)) || $date->format('Y-m') !== $month) {
                return null;
            }
            if ($month >= $asOf->format('Y-m')) {
                continue;
            }
            if (isset($indexed[$month])) {
                return null;
            }
            $indexed[$month] = $snapshot;
        }
        if (! $indexed) {
            return null;
        }
        ksort($indexed, SORT_STRING);
        $months = $this->monthsEndingAt(array_key_last($indexed), $asOf);
        $catalog = null;
        $models = [];
        $transfers = $identified = $unmatched = 0;
        foreach ($months as $month) {
            $snapshot = $indexed[$month] ?? [];
            if (! $this->validSnapshot($snapshot)
                || ($catalog !== null && $catalog !== $snapshot['catalog_snapshot_id'])) {
                return null;
            }
            $catalog = $snapshot['catalog_snapshot_id'];
            $transfers += $snapshot['transfers'];
            $identified += $snapshot['identified'];
            $unmatched += $snapshot['unmatched'];
            if (! is_int($transfers) || ! is_int($identified) || ! is_int($unmatched)) {
                return null;
            }
            foreach ($snapshot['models'] as $row) {
                $key = json_encode([$row['make'], $row['model'], $row['special']]);
                $models[$key] ??= ['make' => $row['make'], 'model' => $row['model'], 'special' => $row['special'], 'transfers' => 0];
                $models[$key]['transfers'] += $row['transfers'];
            }
        }
        $models = array_values($models);
        usort($models, fn ($a, $b) => $b['transfers'] <=> $a['transfers']
            ?: [$a['make'], $a['model'], $a['special']] <=> [$b['make'], $b['model'], $b['special']]);
        $previous = null;
        $better = 0;
        foreach ($models as $index => &$model) {
            if ($previous !== $model['transfers']) {
                $better = $index;
            }
            $previous = $model['transfers'];
            // Competition rank, integer bands: ties never split at a percentile cutoff.
            $model['score'] = 100 - 20 * min(4, intdiv($better * 5, max(1, count($models) - 1)));
        }

        return ['source' => 'DNRPA', 'window_start' => $months[0], 'window_end' => $months[5],
            'catalog_snapshot_id' => $catalog, 'months' => $months, 'transfers' => $transfers,
            'identified' => $identified, 'unmatched' => $unmatched, 'models' => $models];
    }

    private function validSnapshot(array $snapshot): bool
    {
        if (($snapshot['source'] ?? null) !== 'DNRPA' || ! is_string($snapshot['catalog_snapshot_id'] ?? null)
            || trim($snapshot['catalog_snapshot_id']) === '' || ! is_array($snapshot['models'] ?? null)) {
            return false;
        }
        foreach (['transfers', 'identified', 'unmatched'] as $field) {
            if (! is_int($snapshot[$field] ?? null) || $snapshot[$field] < 0) {
                return false;
            }
        }
        $seen = [];
        $sum = 0;
        foreach ($snapshot['models'] as $row) {
            foreach (['make', 'model'] as $field) {
                if (! is_string($row[$field] ?? null) || ! preg_match('/^[a-z0-9]+(?: [a-z0-9]+)*$/D', $row[$field])) {
                    return false;
                }
            }
            if (! is_array($row['special'] ?? null)
                || array_values(array_intersect(['diesel', 'gti'], $row['special'])) !== $row['special']
                || ! is_int($row['transfers'] ?? null) || $row['transfers'] <= 0) {
                return false;
            }
            $key = json_encode([$row['make'], $row['model'], $row['special']]);
            if (isset($seen[$key]) || ! is_int($sum += $row['transfers'])) {
                return false;
            }
            $seen[$key] = true;
        }

        return $snapshot['transfers'] > 0 && $sum === $snapshot['identified']
            && $snapshot['unmatched'] === $snapshot['transfers'] - $snapshot['identified'];
    }
}
