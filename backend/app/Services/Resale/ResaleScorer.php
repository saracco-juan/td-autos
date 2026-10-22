<?php

namespace App\Services\Resale;

use Illuminate\Support\Str;

/** Batch local evidence only: exact inventory labels, never aliases or remote lookups. */
final class ResaleScorer
{
    public function scores(iterable $vehicles, array $prices, array $transfers): array
    {
        $catalog = $prices['snapshot'];
        $activity = $transfers['snapshot']['activity'] ?? null;
        $curves = $groups = $results = [];
        foreach ($catalog['rows'] ?? [] as $row) {
            $key = $this->key([$row['make'], $row['model'], $row['version']]);
            $curves[$key][] = $row;
        }
        foreach ($activity['models'] ?? [] as $row) {
            $groups[$this->key([$row['make'], $row['model'], implode(' ', $row['special'])])][] = $row;
        }
        $calculator = new ValueRetentionCalculator;
        foreach ($vehicles as $vehicle) {
            $matches = $curves[$this->key([$vehicle->marca, $vehicle->modelo, $vehicle->version ?? ''])] ?? [];
            $row = count($matches) === 1 ? $matches[0] : null;
            $comparison = $retention = $activityScore = null;
            if ($row !== null) {
                $point = ['snapshot_id' => $catalog['snapshot_id'], 'version_id' => $row['version_id'],
                    'currency' => $row['currency'], 'model_year' => (int) $vehicle->anio,
                    'price' => $row['values'][$vehicle->anio] ?? null];
                $older = array_replace($point, ['model_year' => $vehicle->anio - 3,
                    'price' => $row['values'][$vehicle->anio - 3] ?? null]);
                $comparison = $calculator->compare($point, $older);
                $retention = $calculator->threeYearScore($point, $older);
                // Exactly the reader's explicit, catalog-corroborated special markers.
                $tokens = explode(' ', $this->normalize($row['model'].' '.$row['version']));
                $special = array_values(array_intersect(['diesel', 'gti'], $tokens));
                $group = $groups[$this->key([$row['make'], $row['model'], implode(' ', $special)])] ?? [];
                $activityScore = count($group) === 1 ? $group[0]['score'] : null;
            }
            $results[$vehicle->id] = [
                'score' => $retention === null || $activityScore === null ? null : ($retention + $activityScore) / 2,
                'activity_score' => $activityScore, 'retention_score' => $retention, 'comparison' => $comparison,
                'source_date' => $catalog['source_date'] ?? null, 'snapshot_id' => $catalog['snapshot_id'] ?? null,
                'window_start' => $activity['window_start'] ?? null, 'window_end' => $activity['window_end'] ?? null,
                'activity_catalog_snapshot_id' => $activity['catalog_snapshot_id'] ?? null,
                'stale' => $prices['stale'] || $transfers['stale'],
            ];
        }

        return $results;
    }

    private function key(array $parts): string
    {
        return json_encode(array_map($this->normalize(...), $parts), JSON_THROW_ON_ERROR);
    }

    private function normalize(string $value): string
    {
        return trim(preg_replace('/[^a-z0-9]+/', ' ', Str::ascii(mb_strtolower($value, 'UTF-8'))));
    }
}
