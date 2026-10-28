<?php

namespace App\Services\Portales;

use App\Models\Diagnostico;
use App\Repositories\AcaraModelPriceRepository;
use App\Repositories\ModeloReferenciaRepository;
use App\Services\ExchangeRates\DolarApi;
use App\Services\Matching\DealershipRanker;

/**
 * HU06: the curated models a buyer can afford, with filtered links to the portals. Reads the saved
 * diagnosis, the stored ACARA prices and (only when a price is in USD) the cached exchange rate.
 */
final class PortalModelRecommendations
{
    public function __construct(
        private readonly DealershipRanker $ranker,
        private readonly ModeloReferenciaRepository $models,
        private readonly AcaraModelPriceRepository $prices,
        private readonly DolarApi $exchange,
        private readonly ModelBudgetFit $budgetFit,
        private readonly ModelRecommender $recommender,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function forUser(int $userId): array
    {
        $diagnosis = Diagnostico::where('usuario_id', $userId)->with('carrocerias')->first();
        $year = now()->year;
        // The ranker owns the readiness rules, so both endpoints agree on what an incomplete diagnosis is.
        if ($diagnosis === null || $this->ranker->rank([], $diagnosis, [], $year, null)['status'] !== 'ready') {
            return ['status' => 'diagnosis_incomplete', 'modelos' => [], 'fuente_precios' => null, 'exchange_rate' => null];
        }
        $budget = $diagnosis->presupuesto_maximo === null ? null : (int) round((float) $diagnosis->presupuesto_maximo);
        $rows = $this->prices->yearRanges(ModelBudgetFit::years($budget, $year));
        $exchange = $rows->contains('currency', 'USD') ? $this->exchange->current() : null;
        $fits = $this->budgetFit->fit($rows, $budget, $exchange['quote']['sell'] ?? null, $year);
        $recommendations = $this->recommender->recommend($this->models->all(), $fits, $diagnosis);

        $response = [
            'status' => 'ready',
            'modelos' => array_map(fn (ModelRecommendation $recommendation) => $recommendation->payload, $recommendations),
            'fuente_precios' => ['nombre' => 'Guía de precios ACARA', 'fecha' => $this->prices->sourceDate()],
        ];
        if ($exchange !== null && array_filter($recommendations, fn (ModelRecommendation $r) => $r->usedUsd) !== []) {
            $response['exchange_rate'] = $exchange;
        }

        return $response;
    }
}
