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
     * @return array{purchase: array{price: int, transfer: int, total: int}, monthly: array{fuel: ?int, insurance: int, patente: int, maintenance: int, total: int, yearly_total: int, not_estimated: list<string>}, breakdown: array<string, mixed>}
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

        $fuelInputs = $this->fuelInputs($vehicle, $kmPerMonth, $rates);
        $fuel = $fuelInputs === null ? null
            : $this->ceil($kmPerMonth * $fuelInputs['consumption_l_100km'] / 100 * (float) $fuelInputs['unit_price'], $step);
        $insuranceRate = (float) $rates['insurance_annual_rate'][$coverage];
        $insurance = $this->ceil($base * $insuranceRate / 12, $step);
        $patenteRate = $this->provinceRate($rates['patente_annual_rate'], $slug);
        $patente = $this->ceil($base * $patenteRate / 12, $step);
        $maintenanceInputs = $this->maintenanceInputs($vehicle, $rates, $currentYear);
        $maintenance = $this->ceil($maintenanceInputs['yearly'] / 12, $step);

        $total = ($fuel ?? 0) + $insurance + $patente + $maintenance;
        $provinceName = trim($province);
        $patenteKnown = isset($rates['patente_annual_rate'][$slug]);
        $stampKnown = isset($rates['transfer']['stamp_rate'][$slug]);

        return [
            'purchase' => ['price' => $price, 'transfer' => $transfer, 'total' => $price + $transfer],
            'monthly' => [
                'fuel' => $fuel, 'insurance' => $insurance, 'patente' => $patente, 'maintenance' => $maintenance,
                'total' => $total, 'yearly_total' => $total * 12,
                'not_estimated' => $fuel === null ? ['fuel'] : [],
            ],
            'breakdown' => [
                'fuel' => $fuelInputs === null ? null : ['km_per_month' => $kmPerMonth] + $fuelInputs,
                'insurance' => ['base' => $base, 'coverage' => $coverage, 'annual_rate' => $insuranceRate],
                'patente' => ['base' => $base, 'province' => $provinceName, 'province_known' => $patenteKnown, 'annual_rate' => $patenteRate],
                'maintenance' => array_diff_key($maintenanceInputs, ['yearly' => true]),
                'transfer' => [
                    'base' => $base, 'dnrpa_rate' => (float) $rates['transfer']['dnrpa_rate'], 'stamp_rate' => $stamp,
                    'province' => $provinceName, 'province_known' => $stampKnown,
                    'fixed_costs' => (float) $rates['transfer']['fixed_costs'],
                ],
                'rounding' => $step,
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

    /** @return array{consumption_l_100km: float, fuel_type: string, price_fuel_type: string, unit: string, unit_price: float|int}|null */
    private function fuelInputs(array $vehicle, int $kmPerMonth, array $rates): ?array
    {
        $figures = array_filter([$vehicle['consumo_urbano'] ?? null, $vehicle['consumo_ruta'] ?? null],
            fn ($value) => is_numeric($value) && (float) $value > 0);
        $priceType = match ($vehicle['fuel']) {
            'nafta', 'hibrido' => 'nafta',
            'diesel' => 'diesel',
            'gnc' => 'gnc',
            default => null,
        };
        if ($figures === [] || $priceType === null) {
            return null;
        }

        return [
            'consumption_l_100km' => (float) max($figures), 'fuel_type' => $vehicle['fuel'], 'price_fuel_type' => $priceType,
            'unit' => $priceType === 'gnc' ? 'm3' : 'litro', 'unit_price' => $rates['fuel_prices'][$priceType],
        ];
    }

    /** @return array{fuel_type: string, annual_base: float, age_years: int, age_factor: float, km: int, km_factor: float, turbo_factor: ?float, automatic_factor: ?float, yearly: float} */
    private function maintenanceInputs(array $vehicle, array $rates, int $currentYear): array
    {
        $maintenance = $rates['maintenance'];
        $bases = $maintenance['annual_base'];
        $age = max(0, $currentYear - (int) $vehicle['anio']);
        $annualBase = (float) ($bases[$vehicle['fuel']] ?? max($bases));
        $ageFactor = $this->band($maintenance['age_factors'], $age);
        $kmFactor = $this->band($maintenance['km_factors'], (int) $vehicle['kilometraje']);
        $turbo = $vehicle['turbo'] ? (float) $maintenance['turbo_factor'] : null;
        $automatic = $vehicle['transmision'] === 'automatica' ? (float) $maintenance['automatic_factor'] : null;

        return [
            'fuel_type' => $vehicle['fuel'], 'annual_base' => $annualBase, 'age_years' => $age, 'age_factor' => $ageFactor,
            'km' => (int) $vehicle['kilometraje'], 'km_factor' => $kmFactor, 'turbo_factor' => $turbo, 'automatic_factor' => $automatic,
            'yearly' => $annualBase * $ageFactor * $kmFactor * ($turbo ?? 1.0) * ($automatic ?? 1.0),
        ];
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
