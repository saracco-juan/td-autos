<?php

namespace App\Services\Calculadora;

/**
 * Ceiling estimate of what a vehicle costs to buy and to keep per month. Pure: no database, HTTP or clock.
 * Every concept rounds up and totals add the rounded concepts, so the screen always adds up.
 */
final class OwnershipCostCalculator
{
    private const PROVINCE_ALIASES = [
        'capital_federal' => 'caba',
        'ciudad_autonoma_de_buenos_aires' => 'caba',
        'ciudad_de_buenos_aires' => 'caba',
        'provincia_de_buenos_aires' => 'buenos_aires',
        'pba' => 'buenos_aires',
    ];

    /**
     * @param  array{price_ars: float|int, fuel: string, consumo_urbano: mixed, consumo_ruta: mixed, anio: int, kilometraje: int, turbo: bool, transmision: string}  $vehicle
     * @param  array<string, mixed>  $rates  config('calculadora')
     * @return array{purchase: array{price: int, transfer: int, total: int}, monthly: array{fuel: ?int, insurance: int, patente: int, maintenance: int, total: int, yearly_total: int, not_estimated: list<string>}}
     */
    public function calculate(array $vehicle, string $province, int $kmPerMonth, string $coverage, array $rates, int $currentYear): array
    {
        $step = (int) $rates['rounding'];
        $base = (float) $vehicle['price_ars'];
        $slug = $this->normalizeProvince($province);

        $stamp = $this->provinceRate($rates['transfer']['stamp_rate'], $slug);
        $transferRaw = $base * ((float) $rates['transfer']['dnrpa_rate'] + $stamp) + (float) $rates['transfer']['fixed_costs'];
        $price = $this->ceil($base, $step);
        $transfer = $this->ceil($transferRaw, $step);

        $fuel = $this->fuel($vehicle, $kmPerMonth, $rates, $step);
        $insurance = $this->ceil($base * (float) $rates['insurance_annual_rate'][$coverage] / 12, $step);
        $patente = $this->ceil($base * $this->provinceRate($rates['patente_annual_rate'], $slug) / 12, $step);
        $maintenance = $this->ceil($this->maintenanceYearly($vehicle, $rates, $currentYear) / 12, $step);

        $total = ($fuel ?? 0) + $insurance + $patente + $maintenance;

        return [
            'purchase' => ['price' => $price, 'transfer' => $transfer, 'total' => $price + $transfer],
            'monthly' => [
                'fuel' => $fuel, 'insurance' => $insurance, 'patente' => $patente, 'maintenance' => $maintenance,
                'total' => $total, 'yearly_total' => $total * 12,
                'not_estimated' => $fuel === null ? ['fuel'] : [],
            ],
        ];
    }

    public function normalizeProvince(string $province): string
    {
        $text = mb_strtolower(trim($province));
        $text = strtr($text, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
        $slug = trim((string) preg_replace('/[^a-z0-9]+/', '_', $text), '_');

        return self::PROVINCE_ALIASES[$slug] ?? $slug;
    }

    /** Unknown provinces take the highest rate of the map: the estimate stays a ceiling. */
    private function provinceRate(array $map, string $slug): float
    {
        return (float) ($map[$slug] ?? max($map));
    }

    private function fuel(array $vehicle, int $kmPerMonth, array $rates, int $step): ?int
    {
        $figures = array_filter([$vehicle['consumo_urbano'] ?? null, $vehicle['consumo_ruta'] ?? null],
            fn ($value) => is_numeric($value) && (float) $value > 0);
        $price = match ($vehicle['fuel']) {
            'nafta', 'hibrido' => $rates['fuel_prices']['nafta'],
            'diesel' => $rates['fuel_prices']['diesel'],
            'gnc' => $rates['fuel_prices']['gnc'],
            default => null,
        };
        if ($figures === [] || $price === null) {
            return null;
        }

        return $this->ceil($kmPerMonth * (float) max($figures) / 100 * (float) $price, $step);
    }

    private function maintenanceYearly(array $vehicle, array $rates, int $currentYear): float
    {
        $maintenance = $rates['maintenance'];
        $bases = $maintenance['annual_base'];
        $age = max(0, $currentYear - (int) $vehicle['anio']);

        return (float) ($bases[$vehicle['fuel']] ?? max($bases))
            * $this->band($maintenance['age_factors'], $age)
            * $this->band($maintenance['km_factors'], (int) $vehicle['kilometraje'])
            * ($vehicle['turbo'] ? (float) $maintenance['turbo_factor'] : 1.0)
            * ($vehicle['transmision'] === 'automatica' ? (float) $maintenance['automatic_factor'] : 1.0);
    }

    /** @param list<array{max: ?int, factor: float}> $bands */
    private function band(array $bands, float $value): float
    {
        foreach ($bands as $band) {
            if ($band['max'] === null || $value <= $band['max']) {
                return (float) $band['factor'];
            }
        }

        return (float) end($bands)['factor'];
    }

    private function ceil(float $amount, int $step): int
    {
        // Rounding the ratio first absorbs float noise (66000.00000000001 must not become 67000).
        return (int) (ceil(round($amount / $step, 6)) * $step);
    }
}
