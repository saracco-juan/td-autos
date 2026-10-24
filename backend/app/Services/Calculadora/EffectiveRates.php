<?php

namespace App\Services\Calculadora;

/**
 * The calculator rates in force: config('calculadora') overridden by the latest valid refresh snapshot.
 * Fuel: the dealer's province, then the national value, then the config. ARS amounts (maintenance bases,
 * transfer fixed costs) are scaled by max(1, cpi_latest / cpi_base). The insurance bases are scaled the same way
 * from their own base month (`insurance.cpi_base_month`). Percentages are never touched.
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

        $cpi = $payload['cpi'] ?? null;
        $factor = $this->cpiFactor($cpi, (string) ($rates['cpi_base_month'] ?? ''));
        if ($factor > 1) {
            $rates['maintenance']['annual_base'] = array_map(fn ($amount) => (int) round($amount * $factor), $rates['maintenance']['annual_base']);
            $rates['transfer']['fixed_costs'] = (int) round($rates['transfer']['fixed_costs'] * $factor);
        }
        $insuranceFactor = $this->cpiFactor($cpi, (string) ($rates['insurance']['cpi_base_month'] ?? ''));
        if ($insuranceFactor > 1) {
            $rates['insurance']['tc_base'] = array_map(fn ($amount) => (int) round($amount * $insuranceFactor), $rates['insurance']['tc_base']);
        }
        $rates['updated_at'] = $snapshot->fetched_at->toDateString();

        return $rates;
    }

    /**
     * The index of `$baseMonth` is the snapshot's main base or one of its extra bases (snapshots stored before the
     * extra bases existed simply have none). A month the snapshot does not know cannot index anything until the
     * next refresh.
     */
    private function cpiFactor(?array $cpi, string $baseMonth): float
    {
        $baseValue = match (true) {
            $cpi === null || $baseMonth === '' => 0.0,
            ($cpi['base_month'] ?? null) === $baseMonth => (float) ($cpi['base_value'] ?? 0),
            default => (float) ($cpi['extra_bases'][$baseMonth] ?? 0),
        };
        if ($baseValue <= 0) {
            return 1.0;
        }

        return max(1.0, (float) $cpi['latest_value'] / $baseValue);
    }
}
