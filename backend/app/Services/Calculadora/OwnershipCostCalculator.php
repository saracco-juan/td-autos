<?php

namespace App\Services\Calculadora;

/**
 * Ceiling estimate of what a vehicle costs to buy and to keep per month, plus the yearly service. Pure: no database,
 * HTTP or clock. Every concept rounds up and totals add the rounded concepts, so the screen always adds up.
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
     * @param  array{price_ars: float|int, marca?: ?string, modelo?: ?string, body_type?: ?string, fuel: string, consumo_urbano: mixed, consumo_ruta: mixed, anio: int}  $vehicle
     * @param  array<string, mixed>  $rates  config('calculadora')
     * @return array{purchase: array{price: int, transfer: int, total: int}, monthly: array{fuel: ?int, insurance: int, patente: int, total: int, not_estimated: list<string>}, yearly: array{service: int, total: int}, breakdown: array<string, mixed>}
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
        $insuranceCalc = $this->insurance($vehicle['body_type'] ?? null, $base, $slug, $province, $coverage, $rates['insurance'], $step);
        $insurance = $insuranceCalc['amount'];
        $patenteCalc = $this->patente($base, $slug, trim($province), $rates['patente']);
        $patente = $this->ceil($patenteCalc['annual'] / 12, $step);
        $serviceCalc = $this->service($vehicle, $kmPerMonth, $rates['service']);
        $service = $this->ceil($serviceCalc['yearly'], $step);

        $total = ($fuel ?? 0) + $insurance + $patente;
        $provinceName = trim($province);
        $stampKnown = isset($rates['transfer']['stamp_rate'][$slug]);

        return [
            'purchase' => ['price' => $price, 'transfer' => $transfer, 'total' => $price + $transfer],
            'monthly' => [
                'fuel' => $fuel, 'insurance' => $insurance, 'patente' => $patente, 'total' => $total,
                'not_estimated' => $fuel === null ? ['fuel'] : [],
            ],
            'yearly' => ['service' => $service, 'total' => $total * 12 + $service],
            'breakdown' => [
                'fuel' => $fuelInputs === null ? null : ['km_per_month' => $kmPerMonth] + $fuelInputs,
                'insurance' => $insuranceCalc['breakdown'],
                'patente' => $patenteCalc,
                'service' => array_diff_key($serviceCalc, ['yearly' => true]),
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
        $slug = $this->slug($province);

        return self::PROVINCE_ALIASES[$slug] ?? $slug;
    }

    private function slug(string $text): string
    {
        $text = mb_strtolower(trim($text));
        $text = strtr($text, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);

        return trim((string) preg_replace('/[^a-z0-9]+/', '_', $text), '_');
    }

    /**
     * Terceros completo = max(base by body type, price x value rate / 12) x zone factor, rounded up.
     * Todo riesgo = max(rounded terceros completo x ratio by body type, price x value rate / 12), rounded up.
     * An unknown body type takes the highest base and ratio; a province outside the zone map takes `default`.
     *
     * @param  array<string, mixed>  $insurance  rates['insurance']
     * @return array{amount: int, breakdown: array<string, mixed>}
     */
    private function insurance(?string $bodyName, float $base, string $provinceSlug, string $province, string $coverage, array $insurance, int $step): array
    {
        $bodySlug = $this->bodySlug($bodyName);
        $baseMonthly = (float) ($insurance['tc_base'][$bodySlug] ?? max($insurance['tc_base']));
        $zoneKnown = $provinceSlug !== 'default' && isset($insurance['zone_factor'][$provinceSlug]);
        $zone = (float) ($zoneKnown ? $insurance['zone_factor'][$provinceSlug] : $insurance['zone_factor']['default']);

        $tcByValue = $base * (float) $insurance['value_rate_tc'] / 12;
        $terceros = $this->ceil(max($baseMonthly, $tcByValue) * $zone, $step);

        $trRatio = null;
        $valueRate = (float) $insurance['value_rate_tc'];
        $byValue = $tcByValue > $baseMonthly;
        $amount = $terceros;
        if ($coverage === 'todo_riesgo') {
            $trRatio = (float) ($insurance['tr_ratio'][$bodySlug] ?? max($insurance['tr_ratio']));
            $valueRate = (float) $insurance['value_rate_tr'];
            $trByValue = $base * $valueRate / 12;
            $byValue = $trByValue > $terceros * $trRatio;
            $amount = $this->ceil(max($terceros * $trRatio, $trByValue), $step);
        }

        return [
            'amount' => $amount,
            'breakdown' => [
                'coverage' => $coverage, 'base' => $base,
                'body_type' => isset($insurance['tc_base'][$bodySlug]) ? $bodySlug : null,
                'body_label' => isset($insurance['tc_base'][$bodySlug]) ? trim((string) $bodyName) : null,
                'base_monthly' => $baseMonthly, 'value_rate' => $valueRate, 'by_value' => $byValue,
                'zone_factor' => $zone, 'province' => trim($province), 'province_known' => $zoneKnown,
                'tr_ratio' => $trRatio, 'terceros_completo' => $terceros,
            ],
        ];
    }

    /**
     * Annual patente, by the scheme of the province: progressive `scale` (fixed + rate x the excess over the previous
     * limit), `bracket_rate` (one rate over the whole price, chosen by bracket) or `flat_rate`. A price equal to a limit
     * belongs to the bracket that ends there. A province outside the three maps takes the highest flat rate.
     *
     * @param  array<string, mixed>  $patente  rates['patente']
     * @return array{base: float, province: string, province_known: bool, method: string, rate: float, bracket_fixed: ?float, bracket_from: ?float, annual: float}
     */
    private function patente(float $base, string $slug, string $province, array $patente): array
    {
        $result = ['base' => $base, 'province' => $province, 'province_known' => true, 'bracket_fixed' => null, 'bracket_from' => null];

        if (isset($patente['scale'][$slug])) {
            $from = 0.0;
            foreach ($patente['scale'][$slug] as $bracket) {
                if ($bracket['up_to'] === null || $base <= $bracket['up_to']) {
                    $fixed = (float) $bracket['fixed'];
                    $rate = (float) $bracket['rate'];

                    return array_merge($result, ['method' => 'scale', 'rate' => $rate, 'bracket_fixed' => $fixed, 'bracket_from' => $from,
                        'annual' => $fixed + $rate * ($base - $from)]);
                }
                $from = (float) $bracket['up_to'];
            }
        }
        if (isset($patente['bracket_rate'][$slug])) {
            foreach ($patente['bracket_rate'][$slug] as $bracket) {
                if ($bracket['up_to'] === null || $base <= $bracket['up_to']) {
                    return array_merge($result, ['method' => 'bracket_rate', 'rate' => (float) $bracket['rate'], 'annual' => $base * (float) $bracket['rate']]);
                }
            }
        }

        $rate = $this->provinceRate($patente['flat_rate'], $slug);

        return array_merge($result, ['province_known' => isset($patente['flat_rate'][$slug]), 'method' => 'flat', 'rate' => $rate, 'annual' => $base * $rate]);
    }

    /** "Rural / familiar" and "Rural" are the same body type. */
    private function bodySlug(?string $name): string
    {
        $slug = $this->slug((string) $name);

        return str_starts_with($slug, 'rural') ? 'rural' : $slug;
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

    /**
     * Yearly service = services per year x price per service x fuel factor, rounded up by the caller.
     * Services per year = ceil(max(km per year / interval km, 12 / interval months)).
     * The price comes from brand + model, then brand + body type, then the reference value of the body type; an unknown
     * body type takes the highest reference value and an unknown fuel the highest factor.
     *
     * @param  array<string, mixed>  $service  rates['service']
     * @return array{brand: ?string, brand_known: bool, model_matched: bool, body_type: ?string, body_label: ?string, km_per_year: int, interval_km: int, interval_months: int, services_per_year: int, price_per_service: float, fuel_factor: float, source_label: string, yearly: float}
     */
    private function service(array $vehicle, int $kmPerMonth, array $service): array
    {
        $bodyName = $vehicle['body_type'] ?? null;
        $bodySlug = $this->bodySlug($bodyName);
        $fallback = $service['fallback'];
        $brandKey = $this->brandKey((string) ($vehicle['marca'] ?? ''), $service['brands']);
        $brand = $brandKey === null ? null : $service['brands'][$brandKey];
        $modelKey = $brand === null ? null : $this->modelKey((string) ($vehicle['modelo'] ?? ''), array_keys($brand['models'] ?? []));

        if ($brand !== null && $modelKey !== null) {
            $price = (float) $brand['models'][$modelKey];
            $intervalKm = (int) ($brand['model_overrides'][$modelKey]['interval_km'] ?? $brand['interval_km']);
            $label = 'service oficial '.$brand['label'].' '.trim((string) $vehicle['modelo']);
        } elseif ($brand !== null && isset($brand['body'][$bodySlug])) {
            $price = (float) $brand['body'][$bodySlug];
            $intervalKm = (int) $brand['interval_km'];
            $label = 'service oficial '.$brand['label'];
        } else {
            $brand = null;
            $price = (float) ($fallback['body'][$bodySlug] ?? max($fallback['body']));
            $intervalKm = (int) $fallback['interval_km'];
            $label = 'valor de referencia';
        }
        $intervalMonths = (int) (($brand ?? $fallback)['interval_months']);

        $kmPerYear = $kmPerMonth * 12;
        // Rounding the ratio first absorbs float noise (exactly two intervals must not become three services).
        $services = (int) ceil(round(max($kmPerYear / $intervalKm, 12 / $intervalMonths), 6));
        $fuelFactor = (float) ($service['fuel_factor'][$vehicle['fuel']] ?? max($service['fuel_factor']));
        $bodyKnown = isset($fallback['body'][$bodySlug]);

        return [
            // brand_known: the brand has data, even when this vehicle ended up on the reference value.
            'brand' => $brandKey === null ? null : (string) $service['brands'][$brandKey]['label'],
            'brand_known' => $brandKey !== null, 'model_matched' => $modelKey !== null && $brand !== null,
            'body_type' => $bodyKnown ? $bodySlug : null, 'body_label' => $bodyKnown ? trim((string) $bodyName) : null,
            'km_per_year' => $kmPerYear, 'interval_km' => $intervalKm, 'interval_months' => $intervalMonths,
            'services_per_year' => $services, 'price_per_service' => $price, 'fuel_factor' => $fuelFactor,
            'source_label' => $label, 'yearly' => $services * $price * $fuelFactor,
        ];
    }

    /**
     * The configured brand a `marca` refers to (its key or one of its aliases), ignoring case and accents.
     *
     * @param  array<string, array<string, mixed>>  $brands
     */
    private function brandKey(string $marca, array $brands): ?string
    {
        $name = $this->words($marca);
        if ($name === '') {
            return null;
        }
        foreach ($brands as $key => $brand) {
            $names = array_map($this->words(...), [(string) $key, ...(array) ($brand['aliases'] ?? [])]);
            if (in_array($name, $names, true)) {
                return (string) $key;
            }
        }

        return null;
    }

    /**
     * The longest configured model that appears as whole words inside the vehicle's `modelo` ("Gol Trend" matches
     * "gol"; "Corolla Cross" matches "corolla cross" before "corolla"; "Golf" never matches "gol").
     *
     * @param  list<string|int>  $models
     */
    private function modelKey(string $modelo, array $models): ?string
    {
        $haystack = ' '.$this->words($modelo).' ';
        $best = null;
        foreach ($models as $model) {
            $needle = $this->words((string) $model);
            if ($needle !== '' && str_contains($haystack, ' '.$needle.' ') && ($best === null || strlen($needle) > strlen($this->words($best)))) {
                $best = (string) $model;
            }
        }

        return $best;
    }

    /** Lowercase, accent-free words separated by single spaces ("T-Cross" and "t cross" are the same). */
    private function words(string $text): string
    {
        return str_replace('_', ' ', $this->slug($text));
    }

    private function ceil(float $amount, int $step): int
    {
        // Rounding the ratio first absorbs float noise (66000.00000000001 must not become 67000).
        return (int) (ceil(round($amount / $step, 6)) * $step);
    }
}
