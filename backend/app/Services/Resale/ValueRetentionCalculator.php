<?php

namespace App\Services\Resale;

/** Same-date model-year references, not observed history or future sale prices. */
final class ValueRetentionCalculator
{
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
