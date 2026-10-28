<?php

namespace App\Services\Portales;

use App\Models\Diagnostico;
use App\Models\ModeloReferencia;

/**
 * Picks and orders the curated models for a diagnosis and links each one to the portals. Pure: no queries, no HTTP.
 */
final class ModelRecommender
{
    private const LIMIT = 8;

    /** Body type name => key of the portal link filters. The portals filter by these two only. */
    private const BODY_KEYS = ['Sedán' => 'sedan', 'Hatchback' => 'hatchback'];

    public function __construct(
        private readonly ModelScorer $scorer = new ModelScorer,
        private readonly ModelCopy $copy = new ModelCopy,
        private readonly PortalLinkBuilder $links = new PortalLinkBuilder,
    ) {}

    /**
     * @param  iterable<ModeloReferencia>  $models  With `tipoCarroceria` loaded.
     * @param  array<int, ModelFit>  $fits  By model id; models without an entry do not fit the budget.
     * @param  Diagnostico  $diagnosis  Complete, with `carrocerias` loaded.
     * @return list<ModelRecommendation>
     */
    public function recommend(iterable $models, array $fits, Diagnostico $diagnosis): array
    {
        $bodyIds = $diagnosis->carrocerias->pluck('id')->map(fn ($id) => (int) $id)->all();
        $ranked = [];
        foreach ($models as $model) {
            $fit = $fits[$model->id] ?? null;
            if ($fit !== null && $this->allowed($model, $diagnosis, $bodyIds)) {
                $ranked[] = [$model, $fit, round($this->scorer->score($model, $diagnosis->uso_principal, $diagnosis->prioridad_comprador), 6)];
            }
        }
        usort($ranked, fn (array $a, array $b) => ($b[2] <=> $a[2]) ?: (count($b[1]->years) <=> count($a[1]->years))
            ?: strcmp($a[0]->marca, $b[0]->marca) ?: strcmp($a[0]->modelo, $b[0]->modelo));

        return array_map(fn (array $row) => $this->present($row[0], $row[1], $diagnosis), array_slice($ranked, 0, self::LIMIT));
    }

    /**
     * @param  list<int>  $bodyIds
     */
    private function allowed(ModeloReferencia $model, Diagnostico $diagnosis, array $bodyIds): bool
    {
        return in_array((int) $model->tipo_carroceria_id, $bodyIds, true)
            && $model->plazas >= (int) $diagnosis->pasajeros
            && match ($diagnosis->transmision_preferida) {
                'automatica' => $model->tiene_automatica,
                'manual' => $model->tiene_manual,
                default => true,
            };
    }

    private function present(ModeloReferencia $model, ModelFit $fit, Diagnostico $diagnosis): ModelRecommendation
    {
        $search = new PortalSearch(
            routes: array_filter(['mercadolibre' => $model->ruta_mercadolibre, 'kavak' => $model->ruta_kavak]),
            transmission: $diagnosis->transmision_preferida === 'indiferente' ? null : $diagnosis->transmision_preferida,
            yearFrom: min($fit->years),
            yearTo: max($fit->years),
            maxPriceArs: $diagnosis->presupuesto_maximo === null ? null : (int) round((float) $diagnosis->presupuesto_maximo),
            body: self::BODY_KEYS[$model->tipoCarroceria->nombre] ?? null,
        );

        return new ModelRecommendation([
            'id' => $model->id,
            'marca' => $model->marca,
            'modelo' => $model->modelo,
            'carroceria' => $model->tipoCarroceria->nombre,
            'anios' => ['desde' => $search->yearFrom, 'hasta' => $search->yearTo],
            'precio' => ['desde_ars' => $fit->minArs, 'hasta_ars' => $fit->maxArs, 'anio_referencia' => $fit->referenceYear],
            'motivos' => $this->copy->reasons($model, $diagnosis->uso_principal, $diagnosis->prioridad_comprador),
            'filtros' => $this->copy->filters($search, $model->tipoCarroceria->nombre),
            'links' => array_map(
                fn (PortalLink $link) => ['portal' => $link->portal, 'nombre' => $link->name, 'url' => $link->url],
                $this->links->build($search),
            ),
            'imagen' => $model->imagen_url === null ? null : [
                'url' => $model->imagen_url,
                'autor' => $model->imagen_autor,
                'licencia' => $model->imagen_licencia,
                'pagina' => $model->imagen_pagina,
            ],
        ], $fit->usedUsd);
    }
}
