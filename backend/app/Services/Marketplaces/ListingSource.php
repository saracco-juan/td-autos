<?php

namespace App\Services\Marketplaces;

/**
 * An external marketplace the portal can search (RF05). Adding a marketplace means adding a
 * class that implements this contract (RNF06).
 */
interface ListingSource
{
    /** Stable identifier, stored with each listing (e.g. `mercadolibre`). */
    public function key(): string;

    /** Name shown to the buyer (e.g. `Mercado Libre`). */
    public function label(): string;

    /**
     * @return list<ExternalListing>
     *
     * @throws SourceUnavailableException when the marketplace times out, rejects the request or
     *                                    answers with malformed data.
     */
    public function search(ListingQuery $query): array;
}
