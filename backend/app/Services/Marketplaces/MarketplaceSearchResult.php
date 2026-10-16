<?php

namespace App\Services\Marketplaces;

/**
 * Outcome of one search across all sources.
 */
final class MarketplaceSearchResult
{
    public const OK = 'ok';

    public const NO_RESPONSE = 'sin_respuesta';

    /**
     * @param  list<ExternalListing>  $listings  Source order, then the order each source returned.
     * @param  list<array{clave: string, nombre: string, estado: string}>  $sources  One per source.
     */
    public function __construct(
        public readonly array $listings,
        public readonly array $sources,
    ) {}
}
