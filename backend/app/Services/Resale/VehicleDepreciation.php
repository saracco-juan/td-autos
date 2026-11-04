<?php

namespace App\Services\Resale;

use App\Models\Vehiculo;
use App\Services\Subscription\SubscriptionLifecycle;
use App\Support\VehiculoOptions;

final class VehicleDepreciation
{
    public function __construct(
        private readonly SubscriptionLifecycle $lifecycle,
        private readonly AcaraPriceSource $prices,
        private readonly ResaleScorer $scorer,
        private readonly DepreciationProjection $projection,
    ) {}

    public function forVehicle(int $id): ?array
    {
        $dealers = $this->lifecycle->operativeDealerIds(now());
        $vehicle = Vehiculo::query()->whereKey($id)
            ->where('origen', VehiculoOptions::ORIGEN_CONCESIONARIA)
            ->whereHas('propiedad', fn ($query) => $query->where('visible', true)
                ->whereIn('concesionaria_id', $dealers))->first();
        if ($vehicle === null) {
            return null;
        }

        $prices = $this->prices->current();
        // HU15 consumes the HU05 estimate only. No transfer evidence is supplied or fetched:
        // the scorer consequently leaves activity and combined ranking scores unavailable.
        $evidence = $this->scorer->scores([$vehicle], $prices, ['snapshot' => null, 'stale' => false])[$id];
        $estimate = $evidence['estimate'];
        $projection = $this->projection->calculate($vehicle->precio, $vehicle->moneda, $estimate);

        return [
            'vehicle' => $vehicle->only(['id', 'marca', 'modelo', 'version', 'anio', 'kilometraje']),
            'projection' => $projection,
            'reference' => $projection === null ? null : [
                'source_date' => $evidence['source_date'], 'years_used' => $estimate['years_used'],
                'reference_count' => $estimate['reference_count'] ?? 1,
                'approximate_model' => $evidence['model_match']['reference_model'] ?? null,
                'stale' => $prices['stale'],
            ],
        ];
    }
}
