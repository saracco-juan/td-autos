<?php

namespace App\Services\Resale;

use Illuminate\Support\Str;

/** Batch local evidence only: compatible catalog references, never remote lookups. */
final class ResaleScorer
{
    public function scores(iterable $vehicles, array $prices, array $transfers): array
    {
        $catalog = $prices['snapshot'];
        $activity = $transfers['snapshot']['activity'] ?? null;
        $curves = $identities = $groups = $results = [];
        foreach ($catalog['rows'] ?? [] as $row) {
            $key = $this->key([$row['make'], $row['model']]);
            $curves[$key][] = $row;
            $identities[$row['version_id']][] = $row;
        }
        foreach ($activity['models'] ?? [] as $row) {
            $groups[$this->key([$row['make'], $row['model'], implode(' ', $row['special'])])][] = $row;
        }
        $calculator = new ValueRetentionCalculator;
        $matcher = new ResaleReferenceMatcher;
        foreach ($vehicles as $vehicle) {
            $family = [$vehicle->marca ?? '', $vehicle->modelo ?? ''];
            $linked = is_string($vehicle->acara_version_id ?? null) && $vehicle->acara_version_id !== '';
            if ($linked) {
                $references = $identities[$vehicle->acara_version_id] ?? [];
                // Duplicate references are not resolved by selecting the first price curve.
                $references = count($references) === 1 ? $references : [];
            } else {
                $references = $matcher->candidates($vehicle, $curves[$this->key($family)] ?? []);
            }
            $modelMatch = null;
            if (! $linked && $references === []) {
                $references = $matcher->approximateCandidates($vehicle, $catalog['rows'] ?? []);
                if ($references !== []) {
                    $modelMatch = ['approximate' => true, 'listing_model' => $family[1], 'reference_model' => $references[0]['model']];
                }
            }
            $row = count($references) === 1 ? $references[0] : null;
            $comparison = $retention = $activityScore = $estimate = null;
            if ($row !== null && $modelMatch === null) {
                $point = ['snapshot_id' => $catalog['snapshot_id'], 'version_id' => $row['version_id'],
                    'currency' => $row['currency'], 'model_year' => (int) $vehicle->anio,
                    'price' => $row['values'][$vehicle->anio] ?? null];
                $older = array_replace($point, ['model_year' => $vehicle->anio - 3,
                    'price' => $row['values'][$vehicle->anio - 3] ?? null]);
                $comparison = $calculator->compare($point, $older);
            }
            $estimate = $calculator->estimateGroup($references, $catalog['snapshot_id'] ?? '');
            $retention = $estimate['score'] ?? null;
            // DNRPA measures family activity independently of an available ACARA year pair.
            $tokens = explode(' ', $this->normalize(($vehicle->modelo ?? '').' '.($vehicle->version ?? '')
                .' '.($row['version'] ?? '').' '.($vehicle->combustible ?? '')));
            $special = array_values(array_intersect(['diesel', 'gti'], $tokens));
            $group = $groups[$this->key([...$family, implode(' ', $special)])] ?? [];
            $activityScore = count($group) === 1 ? $group[0]['score'] : null;
            $results[$vehicle->id] = [
                'score' => $retention === null || $activityScore === null ? null : ($retention + $activityScore) / 2,
                'activity_score' => $activityScore, 'retention_score' => $retention, 'comparison' => $comparison,
                'estimate' => $estimate, 'model_match' => $modelMatch,
                'reference' => $row === null ? null : array_intersect_key($row, array_flip(['version_id', 'version', 'currency'])),
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
