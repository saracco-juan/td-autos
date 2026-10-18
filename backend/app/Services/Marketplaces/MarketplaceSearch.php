<?php

namespace App\Services\Marketplaces;

use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Throwable;

/**
 * Searches every enabled marketplace and merges the answers. A source that fails never blocks
 * the others: its failure is reported as a status, not thrown (RF05, RNF06).
 */
class MarketplaceSearch
{
    /**
     * @param  list<ListingSource>  $sources
     */
    public function __construct(private readonly array $sources) {}

    /**
     * Build the aggregator from `marketplaces.sources`. Adding a marketplace means adding a case
     * here and its key to the config.
     */
    public static function fromConfig(): self
    {
        $sources = array_map(fn (string $key): ListingSource => match ($key) {
            'mercadolibre' => app(MercadoLibreSourceFactory::class)->make(),
            default => throw new InvalidArgumentException("Unknown marketplace source [{$key}]."),
        }, (array) config('marketplaces.sources'));

        return new self(array_values($sources));
    }

    /**
     * @return list<string> Keys of the sources this aggregator calls.
     */
    public function keys(): array
    {
        return array_map(fn (ListingSource $source): string => $source->key(), $this->sources);
    }

    /**
     * An aggregator that calls only the given sources, so each can be refreshed on its own schedule.
     *
     * @param  list<string>  $keys
     */
    public function only(array $keys): self
    {
        return new self(array_values(array_filter(
            $this->sources,
            fn (ListingSource $source): bool => in_array($source->key(), $keys, true),
        )));
    }

    public function search(ListingQuery $query): MarketplaceSearchResult
    {
        $listings = [];
        $statuses = [];

        foreach ($this->sources as $source) {
            $estado = MarketplaceSearchResult::OK;

            try {
                array_push($listings, ...$source->search($query));
            } catch (SourceUnavailableException $e) {
                $estado = MarketplaceSearchResult::NO_RESPONSE;
                Log::warning($e->getMessage());
            } catch (Throwable $e) {
                // A bug in one connector must not take the others down.
                $estado = MarketplaceSearchResult::NO_RESPONSE;
                report($e);
            }

            $statuses[] = ['clave' => $source->key(), 'nombre' => $source->label(), 'estado' => $estado];
        }

        return new MarketplaceSearchResult($listings, $statuses);
    }
}
