<?php

namespace App\Services\Portales;

/**
 * The model years of a curated model that fit a budget, and the ARS price range of the newest one.
 */
final readonly class ModelFit
{
    /**
     * @param  list<int>  $years  Fitting model years, ascending.
     */
    public function __construct(
        public int $modelId,
        public array $years,
        public int $referenceYear,
        public int $minArs,
        public int $maxArs,
        public bool $usedUsd,
    ) {}
}
