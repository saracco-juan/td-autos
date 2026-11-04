<?php

namespace App\Services\Matching;

use App\Models\Diagnostico;
use App\Models\Vehiculo;
use App\Models\VehiculoConcesionaria;
use App\Services\ExchangeRates\DolarApi;
use App\Services\Favorites\BuyerFavorites;
use App\Services\Resale\AcaraPriceSource;
use App\Services\Resale\DnrpaActivityStore;
use App\Services\Resale\ResaleScorer;
use App\Services\Subscription\SubscriptionLifecycle;
use App\Support\VehiculoFields;
use App\Support\VehiculoFotos;
use App\Support\VehiculoOptions;

/** Compose current saved answers, available dealer inventory and one quote without persisting rankings. */
final class DiagnosisRecommendations
{
    public function __construct(
        private readonly DealershipRanker $ranker,
        private readonly DolarApi $exchange,
        private readonly SubscriptionLifecycle $lifecycle,
        private readonly BuyerFavorites $favorites,
    ) {}

    public function forUser(int $userId): array
    {
        $diagnosis = Diagnostico::where('usuario_id', $userId)->with('carrocerias')->first();
        if ($diagnosis === null) {
            return ['status' => 'diagnosis_incomplete', 'results' => [], 'exchange_rate' => null];
        }
        $at = now();
        // Let the ranker own readiness; incomplete diagnoses never trigger external work.
        $preflight = $this->ranker->rank([], $diagnosis, [], $at->year, null);
        if ($preflight['status'] !== 'ready') {
            return $preflight + ['exchange_rate' => null];
        }
        $dealerIds = $this->lifecycle->operativeDealerIds($at);
        $vehicles = Vehiculo::query()->where('origen', VehiculoOptions::ORIGEN_CONCESIONARIA)
            ->whereIn('id', VehiculoConcesionaria::query()->select('vehiculo_id')
                ->where('visible', true)->whereIn('concesionaria_id', $dealerIds))
            ->with(['propiedad.concesionaria:id,nombre,provincia', 'tipoCarroceria', 'portada'])
            ->get()->keyBy('id');
        $exchange = $this->exchange->current();
        $resale = $diagnosis->prioridad_comprador === 'reventa'
            ? app(ResaleScorer::class)->scores($vehicles, app(AcaraPriceSource::class)->current(), app(DnrpaActivityStore::class)->current()) : [];
        $ranking = $this->ranker->rank($vehicles, $diagnosis, $dealerIds, $at->year, $exchange['quote']['sell'] ?? null, $resale);
        $favoriteIds = $this->favorites->savedVehicleIds($userId, array_column($ranking['results'], 'listing_id'));
        foreach ($ranking['results'] as &$result) {
            $vehicle = $vehicles->get($result['listing_id']);
            $result['is_favorite'] = in_array($result['listing_id'], $favoriteIds, true);
            $result['vehicle'] = $this->publicFacts($vehicle);
            $result['dealer'] = $vehicle->propiedad->concesionaria->only(['id', 'nombre', 'provincia']);
        }
        unset($result);

        return $ranking + ['exchange_rate' => $exchange];
    }

    private function publicFacts(Vehiculo $vehicle): array
    {
        // Never serialize dealer/ownership models wholesale: they contain private contacts and plates.
        return $vehicle->only(array_merge([
            'id', 'marca', 'modelo', 'version', 'anio', 'kilometraje', 'ubicacion',
            'transmision', 'combustible', 'plazas', 'motor', 'turbo', 'potencia', 'potencia_unidad',
            'consumo_urbano', 'consumo_ruta',
        ], array_keys(VehiculoFields::EQUIPMENT_FIELDS))) + [
            'carroceria' => $vehicle->tipoCarroceria?->nombre,
            'image_url' => $vehicle->portada ? VehiculoFotos::url($vehicle->portada->ubicacion_archivo) : null,
        ];
    }
}
