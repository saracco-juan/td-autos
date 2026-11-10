<?php

namespace App\Services\Resale;

/** HU15 scenarios compound the HU05 rate; they are not observed historical prices. */
final class DepreciationProjection
{
    public function calculate(?float $price, ?string $currency, ?array $estimate): ?array
    {
        $annual = $estimate['annual_retained_percent'] ?? null;
        if ($price === null || ! is_finite($price) || $price <= 0
            || ! in_array($currency, ['ARS', 'USD'], true)
            || ! is_numeric($annual) || ! is_finite((float) $annual) || $annual <= 0) {
            return null;
        }

        $points = [];
        foreach ([1, 3, 5] as $years) {
            $ratio = ($annual / 100) ** $years;
            $value = $price * $ratio;
            if (! is_finite($value) || ! is_finite(100 * $ratio) || $value <= 0) {
                return null;
            }
            $points[] = ['years' => $years, 'value' => round($value, 2),
                'retained_percent' => round(100 * $ratio, 8)];
        }

        return ['current_value' => $price, 'currency' => $currency,
            'annual_depreciation_percent' => round(100 - $annual, 12), 'points' => $points];
    }
}
