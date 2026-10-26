<?php

namespace App\Services\Matching;

use App\Models\Diagnostico;
use App\Models\Vehiculo;
use App\Support\DiagnosticoOptions;
use App\Support\VehiculoMatchingFacts;
use App\Support\VehiculoOptions;

/** Deterministic ranking only: the caller supplies current inventory, operative dealers and one quote. */
final class DealershipRanker
{
    public function __construct(
        private readonly RunningRequirementsScorer $running,
        private readonly VehicleSuitabilityScorer $suitability,
    ) {}

    /**
     * Relations must be eager-loaded; never fetch inventory, exchange rates or the clock here.
     * The caller obtains dealer IDs from SubscriptionLifecycle::operativeDealerIds().
     *
     * @param  iterable<Vehiculo>  $vehicles
     * @param  list<int>  $operativeDealerIds
     * @return array{status: string, results: list<array>}
     */
    public function rank(iterable $vehicles, Diagnostico $diagnosis, array $operativeDealerIds, int $year, ?float $sellRate, array $resale = []): array
    {
        if ($diagnosis->estado !== 'completo' || ! $diagnosis->relationLoaded('carrocerias')
            || ! in_array((int) $diagnosis->pasajeros, DiagnosticoOptions::PASAJEROS, true)
            || ! in_array($diagnosis->transmision_preferida, DiagnosticoOptions::TRANSMISION, true)
            || $diagnosis->carrocerias->isEmpty()) {
            return ['status' => 'diagnosis_incomplete', 'results' => []];
        }
        $rate = $sellRate !== null && is_finite($sellRate) && $sellRate > 0 ? $sellRate : null;
        $bodyIds = $diagnosis->carrocerias->pluck('id')->map(fn ($id) => (int) $id)->all();
        $results = [];
        foreach ($vehicles as $vehicle) {
            if (! $vehicle->relationLoaded('propiedad') || $vehicle->propiedad === null
                || ! $vehicle->propiedad->visible || $vehicle->origen !== VehiculoOptions::ORIGEN_CONCESIONARIA
                || ! in_array((int) $vehicle->propiedad->concesionaria_id, $operativeDealerIds, true)
                || ! $this->hasValidFacts($vehicle, $year)
                || $vehicle->plazas < $diagnosis->pasajeros
                || ($diagnosis->transmision_preferida !== 'indiferente' && $vehicle->transmision !== $diagnosis->transmision_preferida)) {
                continue;
            }
            $row = $this->score($vehicle, $diagnosis, $bodyIds, $year, $rate, $resale[$vehicle->id] ?? null);
            if ($row !== null) {
                $results[] = $row;
            }
        }
        usort($results, fn ($a, $b) => ($b['score'] <=> $a['score'])
            ?: ($a['price_ars'] <=> $b['price_ars']) ?: ($a['listing_id'] <=> $b['listing_id']));

        return ['status' => 'ready', 'results' => array_slice($results, 0, 10)];
    }

    private function hasValidFacts(Vehiculo $vehicle, int $year): bool
    {
        // Same publication rules on raw attributes, so casts cannot hide invalid values; the pure check
        // gives the verdict of the validator without building one per vehicle on every request.
        // Plate uniqueness and body existence are persistence concerns, already enforced on publication.
        return VehiculoMatchingFacts::valid($vehicle->getAttributes() + ['carroceria_id' => $vehicle->tipo_carroceria_id], $year);
    }

    private function score(Vehiculo $vehicle, Diagnostico $diagnosis, array $bodyIds, int $year, ?float $rate, ?array $resale): ?array
    {
        if ($vehicle->moneda === 'USD' && $rate === null) {
            return null;
        }
        $price = (float) $vehicle->precio;
        $ars = $vehicle->moneda === 'USD' ? $price * $rate : $price;
        $usage = $this->suitability->usageScore($vehicle, $diagnosis->uso_principal, $diagnosis->kilometros_mensuales, $year);
        $priority = match ($diagnosis->prioridad_comprador) {
            'consumo' => $this->running->consumptionScore($vehicle, $diagnosis->uso_principal),
            'seguridad' => $this->suitability->safetyScore($vehicle),
            'mantenimiento' => $this->running->maintenanceScore($vehicle, $year),
            'reventa' => $resale['score'] ?? null,
            default => null,
        };
        $comfort = $this->suitability->comfortScore($vehicle);
        $partial = $diagnosis->prioridad_comprador === 'reventa' && $priority === null;
        if ($usage === null || ($priority === null && ! $partial) || $comfort === null || ! is_finite($ars)) {
            return null;
        }
        $body = in_array((int) $vehicle->tipo_carroceria_id, $bodyIds, true) ? 100 : 50;
        $budget = $diagnosis->presupuesto_maximo;
        $excess = $budget !== null && $budget > 0 ? max(0, $ars - $budget) / $budget : 0.0;
        // Compare the money boundary directly: computing a ratio first can overshoot inclusive 5%.
        if ($excess > 0 && ($partial || $ars > $budget * 1.05 || $body !== 100 || $usage !== 100.0 || $priority != 100)) {
            return null;
        }
        $penalty = $excess * 200;
        $known = 0.35 * $usage + 0.30 * $body + 0.10 * $comfort;
        $admission = $partial ? $known / 0.75 : 0.35 * $usage + 0.30 * $body + 0.25 * $priority + 0.10 * $comfort - $penalty;
        if ($admission < 70) {
            return null;
        }

        return [
            'listing_id' => (int) $vehicle->id, 'dealer_id' => (int) $vehicle->propiedad->concesionaria_id,
            'score' => $partial ? $admission - 10 : $admission,
            'components' => ['usage' => $usage, 'body' => $body, 'priority' => $priority, 'comfort' => $comfort],
            'published_price' => $price, 'published_currency' => $vehicle->moneda,
            'price_ars' => $ars, 'price_usd' => $rate === null ? null : $ars / $rate,
            'budget_excess_percent' => $excess * 100, 'budget_penalty' => $penalty,
            'warnings' => array_values(array_filter([$body === 50 ? 'body_mismatch' : null, $excess > 0 ? 'budget_exceeded' : null,
                $partial ? 'resale_unavailable' : null, $diagnosis->prioridad_comprador === 'reventa' && ($resale['stale'] ?? false) ? 'resale_stale' : null])),
        ] + ($diagnosis->prioridad_comprador === 'reventa' ? ['resale' => $resale] : []);
    }
}
