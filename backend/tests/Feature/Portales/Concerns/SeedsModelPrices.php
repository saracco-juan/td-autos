<?php

namespace Tests\Feature\Portales\Concerns;

use App\Models\ModeloReferencia;
use App\Models\TipoCarroceria;
use Illuminate\Support\Facades\DB;

/** Fixture builders for the curated models and the ACARA reference prices they are priced from. */
trait SeedsModelPrices
{
    private int $priceRow = 0;

    /**
     * @param  array<string, mixed>  $overrides  `tipo` picks the body type by name (default Hatchback).
     */
    protected function makeModel(string $marca, string $modelo, array $overrides = []): ModeloReferencia
    {
        $tipo = TipoCarroceria::query()->where('nombre', $overrides['tipo'] ?? 'Hatchback')->firstOrFail();
        unset($overrides['tipo']);

        return ModeloReferencia::query()->create($overrides + [
            'marca' => $marca,
            'modelo' => $modelo,
            'tipo_carroceria_id' => $tipo->id,
            'plazas' => 5,
            'tiene_manual' => true,
            'tiene_automatica' => true,
            'combustibles' => ['nafta'],
            'consumo' => 'medio',
            'seguridad_estrellas' => null,
            'usos' => ['ciudad', 'ruta'],
            'ruta_mercadolibre' => strtolower($marca).'/'.strtolower($modelo),
            'ruta_kavak' => strtolower($marca).'/'.strtolower($modelo),
        ]);
    }

    /**
     * One catalog version of a model with one price per year.
     *
     * @param  array<string, float|int|null>  $amountsByYear  Year (or `0km`) => amount.
     */
    protected function addVersion(string $marca, string $modelo, string $version, array $amountsByYear, string $currency = 'ARS'): void
    {
        $brandId = DB::table('catalog_brands')->where('name', $marca)->value('id')
            ?? DB::table('catalog_brands')->insertGetId(['name' => $marca]);
        $modelId = DB::table('catalog_models')->where('brand_id', $brandId)->where('name', $modelo)->value('id')
            ?? DB::table('catalog_models')->insertGetId(['brand_id' => $brandId, 'name' => $modelo]);
        $versionId = $marca.'|'.$modelo.'|'.$version;
        DB::table('catalog_versions')->insert(['id' => $versionId, 'model_id' => $modelId, 'name' => $version]);
        foreach ($amountsByYear as $year => $amount) {
            DB::table('catalog_prices')->insert([
                'version_id' => $versionId, 'source_row' => ++$this->priceRow, 'source_page' => 1,
                'year' => (string) $year, 'currency' => $currency, 'amount' => $amount,
            ]);
        }
    }
}
