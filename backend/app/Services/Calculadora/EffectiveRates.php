<?php

namespace App\Services\Calculadora;

/**
 * The calculator rates in force: config('calculadora') overridden by the latest valid refresh snapshot.
 * Fuel: the dealer's province, then the national value, then the config. ARS amounts (maintenance bases,
 * transfer fixed costs) are scaled by max(1, cpi_latest / cpi_base). Percentages are never touched.
 */
final class EffectiveRates
{
    public function __construct(private readonly CalculatorRatesStore $store) {}

    /** @return array<string, mixed> The rates input of OwnershipCostCalculator, with flat fuel prices for the province. */
    public function forProvince(string $provinceSlug): array
    {
        $rates = (array) config('calculadora');
        $snapshot = $this->store->latestValid();
        if ($snapshot === null) {
            return $rates;
        }
        $payload = (array) $snapshot->payload;

        foreach ((array) ($rates['fuel_prices'] ?? []) as $type => $configured) {
            $rates['fuel_prices'][$type] = $payload['fuel']['provinces'][$provinceSlug][$type]
                ?? $payload['fuel']['national'][$type] ?? $configured;
        }

        $factor = $this->cpiFactor($payload['cpi'] ?? null, (string) ($rates['cpi_base_month'] ?? ''));
        if ($factor > 1) {
            $rates['maintenance']['annual_base'] = array_map(fn ($amount) => (int) round($amount * $factor), $rates['maintenance']['annual_base']);
            $rates['transfer']['fixed_costs'] = (int) round($rates['transfer']['fixed_costs'] * $factor);
        }
        $rates['updated_at'] = $snapshot->fetched_at->toDateString();

        return $rates;
    }

    /** A snapshot taken against another base month cannot index anything until the next refresh. */
    private function cpiFactor(?array $cpi, string $baseMonth): float
    {
        if ($cpi === null || $baseMonth === '' || ($cpi['base_month'] ?? null) !== $baseMonth || (float) ($cpi['base_value'] ?? 0) <= 0) {
            return 1.0;
        }

        return max(1.0, (float) $cpi['latest_value'] / (float) $cpi['base_value']);
    }
}
