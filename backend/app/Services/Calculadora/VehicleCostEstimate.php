<?php

namespace App\Services\Calculadora;

use App\Models\Diagnostico;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Services\ExchangeRates\DolarApi;
use App\Services\Subscription\SubscriptionLifecycle;
use App\Support\VehiculoOptions;

/** Compose one visible dealer vehicle, the buyer's diagnostico and the rates into the cost estimate. */
final class VehicleCostEstimate
{
    public const NOT_FOUND = 'not_found';

    public const RATE_UNAVAILABLE = 'rate_unavailable';

    public function __construct(
        private readonly OwnershipCostCalculator $calculator,
        private readonly DolarApi $exchange,
        private readonly SubscriptionLifecycle $lifecycle,
        private readonly EffectiveRates $effectiveRates,
    ) {}

    /** @return array<string, mixed>|self::NOT_FOUND|self::RATE_UNAVAILABLE */
    public function forUser(int $userId, int $vehicleId, ?int $km, string $coverage): array|string
    {
        $vehicle = Vehiculo::query()->where('origen', VehiculoOptions::ORIGEN_CONCESIONARIA)
            ->whereKey($vehicleId)
            ->whereIn('id', VehiculoConcesionaria::query()->select('vehiculo_id')
                ->where('visible', true)->whereIn('concesionaria_id', $this->lifecycle->operativeDealerIds(now())))
            ->with(['propiedad.concesionaria:id,provincia', 'tipoCarroceria:id,nombre'])
            ->first();
        if ($vehicle === null) {
            return self::NOT_FOUND;
        }

        $isUsd = $vehicle->moneda === 'USD';
        $exchange = $isUsd ? $this->exchange->current() : null;
        $sell = $exchange['quote']['sell'] ?? null;
        if ($isUsd && ($sell === null || (float) $sell <= 0)) {
            return self::RATE_UNAVAILABLE;
        }
        $price = (float) $vehicle->precio;
        $priceArs = $isUsd ? $price * (float) $sell : $price;

        $diagnosis = Diagnostico::where('usuario_id', $userId)->first();
        $province = (string) $vehicle->propiedad->concesionaria->provincia;
        // Config overridden by the latest refresh snapshot: fuel price of the dealer's province, CPI-indexed ARS amounts.
        $rates = $this->effectiveRates->forProvince($this->calculator->normalizeProvince($province));
        [$kmPerMonth, $source] = $this->km($km, $diagnosis, $rates['km_per_month']);

        $result = $this->calculator->calculate([
            'price_ars' => $priceArs, 'body_type' => $vehicle->tipoCarroceria?->nombre, 'fuel' => $vehicle->combustible,
            'consumo_urbano' => $vehicle->consumo_urbano, 'consumo_ruta' => $vehicle->consumo_ruta,
            'anio' => (int) $vehicle->anio, 'kilometraje' => (int) $vehicle->kilometraje,
            'turbo' => (bool) $vehicle->turbo, 'transmision' => (string) $vehicle->transmision,
        ], $province, $kmPerMonth, $coverage, $rates, now()->year);

        $result['purchase']['budget'] = $this->budget($diagnosis, $result['purchase']['total']);

        return [
            'vehicle' => [
                'id' => (int) $vehicle->id, 'make' => $vehicle->marca, 'model' => $vehicle->modelo, 'version' => $vehicle->version,
                'year' => (int) $vehicle->anio, 'fuel' => $vehicle->combustible, 'province' => $province,
                'published_price' => $price, 'published_currency' => $vehicle->moneda,
            ],
            'inputs' => ['km_per_month' => $kmPerMonth, 'km_source' => $source, 'coverage' => $coverage],
        ] + $result + [
            'rates_updated_at' => $rates['updated_at'],
            'exchange_rate' => $isUsd ? $exchange['quote'] : null,
        ];
    }

    /** @return array{0: int, 1: string} */
    private function km(?int $requested, ?Diagnostico $diagnosis, array $bands): array
    {
        if ($requested !== null) {
            return [$requested, 'usuario'];
        }
        $answer = $diagnosis?->kilometros_mensuales;
        if ($answer !== null && isset($bands[$answer])) {
            return [(int) $bands[$answer], 'diagnostico'];
        }

        return [(int) $bands['no_sabe'], 'default'];
    }

    /** @return array{max: float, fits: bool, difference: float}|null */
    private function budget(?Diagnostico $diagnosis, int $total): ?array
    {
        $max = $diagnosis?->presupuesto_maximo;
        if ($max === null) {
            return null;
        }
        $max = (float) $max;

        return ['max' => $max, 'fits' => $total <= $max, 'difference' => $max - $total];
    }
}
