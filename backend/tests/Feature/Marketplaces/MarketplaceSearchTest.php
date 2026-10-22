<?php

namespace Tests\Feature\Marketplaces;

use App\Services\Marketplaces\ExternalListing;
use App\Services\Marketplaces\ListingQuery;
use App\Services\Marketplaces\ListingSource;
use App\Services\Marketplaces\MarketplaceSearch;
use App\Services\Marketplaces\SourceUnavailableException;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;
use Throwable;

class MarketplaceSearchTest extends TestCase
{
    /**
     * @param  list<string>  $ids
     */
    private function source(string $key, array $ids, ?Throwable $failure = null): ListingSource
    {
        return new class($key, $ids, $failure) implements ListingSource
        {
            /** @param list<string> $ids */
            public function __construct(private string $key, private array $ids, private ?Throwable $failure) {}

            public function key(): string
            {
                return $this->key;
            }

            public function label(): string
            {
                return strtoupper($this->key);
            }

            public function search(ListingQuery $query): array
            {
                if ($this->failure) {
                    throw $this->failure;
                }

                return array_map(fn (string $id) => new ExternalListing(
                    $this->key, $id, "Car $id", 'Fiat', 'Argo', null, 2020, 1000, 1000000, 'ARS',
                    null, null, null, null, "https://example.test/$id", null,
                ), $this->ids);
            }
        };
    }

    public function test_merges_the_listings_of_every_source_in_source_order(): void
    {
        $result = (new MarketplaceSearch([$this->source('a', ['a1', 'a2']), $this->source('b', ['b1'])]))
            ->search(new ListingQuery);

        $this->assertSame(['a1', 'a2', 'b1'], array_map(fn ($l) => $l->externalId, $result->listings));
        $this->assertSame([
            ['clave' => 'a', 'nombre' => 'A', 'estado' => 'ok'],
            ['clave' => 'b', 'nombre' => 'B', 'estado' => 'ok'],
        ], $result->sources);
    }

    public function test_one_failing_source_does_not_hide_the_other(): void
    {
        $result = (new MarketplaceSearch([
            $this->source('a', [], new SourceUnavailableException('a', 'down')),
            $this->source('b', ['b1']),
        ]))->search(new ListingQuery);

        $this->assertSame(['b1'], array_map(fn ($l) => $l->externalId, $result->listings));
        $this->assertSame('sin_respuesta', $result->sources[0]['estado']);
        $this->assertSame('ok', $result->sources[1]['estado']);
    }

    public function test_all_sources_failing_returns_an_empty_list(): void
    {
        $result = (new MarketplaceSearch([
            $this->source('a', [], new SourceUnavailableException('a', 'down')),
            $this->source('b', [], new SourceUnavailableException('b', 'down')),
        ]))->search(new ListingQuery);

        $this->assertSame([], $result->listings);
        $this->assertSame(['sin_respuesta', 'sin_respuesta'], array_column($result->sources, 'estado'));
    }

    public function test_a_connector_bug_is_isolated_too(): void
    {
        $result = (new MarketplaceSearch([
            $this->source('a', [], new RuntimeException('boom')),
            $this->source('b', ['b1']),
        ]))->search(new ListingQuery);

        $this->assertCount(1, $result->listings);
        $this->assertSame('sin_respuesta', $result->sources[0]['estado']);
    }

    public function test_builds_the_enabled_sources_from_config(): void
    {
        config(['marketplaces.sources' => ['mercadolibre']]);

        $result = MarketplaceSearch::fromConfig()->search(new ListingQuery('corolla'));

        $this->assertNotEmpty($result->listings);
        $this->assertSame('mercadolibre', $result->sources[0]['clave']);
    }

    public function test_unknown_source_key_in_config_throws(): void
    {
        config(['marketplaces.sources' => ['nope']]);

        $this->expectException(InvalidArgumentException::class);

        MarketplaceSearch::fromConfig();
    }
}
