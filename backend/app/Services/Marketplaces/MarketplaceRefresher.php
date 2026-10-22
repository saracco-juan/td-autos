<?php

namespace App\Services\Marketplaces;

use Illuminate\Support\Facades\Cache;

/**
 * Calls each external marketplace at most once per cache window and persists what it returns
 * (D5, D9), so a search or a page change never reaches a marketplace. The outcome of the latest
 * refresh of each source is remembered for the same window, failures included: a source that is
 * down is not retried on every request.
 */
class MarketplaceRefresher
{
    public function __construct(private readonly ExternalListingStore $store) {}

    /**
     * Refresh the sources whose window expired and return the status of every enabled source.
     *
     * @return list<array{clave: string, nombre: string, estado: string}>
     */
    public function refresh(MarketplaceSearch $search): array
    {
        $keys = $search->keys();
        $expired = array_values(array_filter($keys, fn (string $key): bool => Cache::get($this->cacheKey($key)) === null));

        if ($expired !== []) {
            $result = $search->only($expired)->search(new ListingQuery);
            $this->store->sync($result->listings);

            $minutes = max(1, (int) config('marketplaces.refresh_minutes', 15));
            foreach ($result->sources as $status) {
                Cache::put($this->cacheKey($status['clave']), $status, now()->addMinutes($minutes));
            }
        }

        // `$keys` keeps the configured order; a status expired between the two reads is rebuilt as unanswered.
        return array_map(
            fn (string $key): array => Cache::get($this->cacheKey($key))
                ?? ['clave' => $key, 'nombre' => $key, 'estado' => MarketplaceSearchResult::NO_RESPONSE],
            $keys,
        );
    }

    private function cacheKey(string $source): string
    {
        return "marketplaces.refresh.{$source}";
    }
}
