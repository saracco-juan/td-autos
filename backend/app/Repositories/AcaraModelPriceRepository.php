<?php

namespace App\Repositories;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * ACARA reference prices of the curated models, read straight from the stored catalog.
 */
final class AcaraModelPriceRepository
{
    /**
     * Cheapest and dearest version of every curated model, per model year and currency, in one query.
     * Models are joined by exact brand and model name; null and non-positive amounts are ignored.
     *
     * @param  list<int>  $years  Numeric model years to read (`0km` and any other label never match).
     * @return Collection<int, object{modelo_id: int, year: string, currency: string, min_amount: string|float, max_amount: string|float}>
     */
    public function yearRanges(array $years): Collection
    {
        return DB::table('modelo_referencia as r')
            ->join('catalog_brands as b', 'b.name', '=', 'r.marca')
            ->join('catalog_models as m', fn ($join) => $join->on('m.brand_id', '=', 'b.id')->on('m.name', '=', 'r.modelo'))
            ->join('catalog_versions as v', 'v.model_id', '=', 'm.id')
            ->join('catalog_prices as p', 'p.version_id', '=', 'v.id')
            ->whereIn('p.year', array_map('strval', $years))
            ->where('p.amount', '>', 0)
            ->groupBy('r.id', 'p.year', 'p.currency')
            ->select('r.id as modelo_id', 'p.year', 'p.currency')
            ->selectRaw('MIN(p.amount) as min_amount, MAX(p.amount) as max_amount')
            ->get();
    }

    /** Date of the price guide the catalog was loaded from (`Y-m-d`), or null when none is loaded. */
    public function sourceDate(): ?string
    {
        $date = DB::table('catalog_import')->value('source_date');

        return $date === null ? null : substr((string) $date, 0, 10);
    }
}
