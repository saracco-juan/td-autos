<?php

namespace Tests\Feature\Marketplaces;

use App\Services\Marketplaces\ListingQuery;
use App\Services\Marketplaces\MercadoLibreApiSource;
use App\Services\Marketplaces\MercadoLibreListingMapper;
use App\Services\Marketplaces\SourceUnavailableException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MercadoLibreApiSourceTest extends TestCase
{
    private const BASE = 'https://api.example.test';

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
    }

    private function source(string $id = 'app-id', string $secret = 'app-secret'): MercadoLibreApiSource
    {
        return new MercadoLibreApiSource($id, $secret, self::BASE, 'MLA', 'MLA1744', 5, 50, new MercadoLibreListingMapper);
    }

    /**
     * @return array<string, mixed>
     */
    private function searchBody(): array
    {
        return ['results' => [[
            'id' => 'MLA1',
            'title' => 'Fiat Argo',
            'price' => 10000000,
            'currency_id' => 'ARS',
            'permalink' => 'https://auto.mercadolibre.com.ar/MLA-1-demo',
            'attributes' => [['id' => 'BRAND', 'value_name' => 'Fiat']],
        ]]];
    }

    private function fakeOk(): void
    {
        Http::fake([
            self::BASE.'/oauth/token' => Http::response(['access_token' => 'tok-123', 'expires_in' => 21600]),
            self::BASE.'/sites/MLA/search*' => Http::response($this->searchBody()),
        ]);
    }

    private function tokenRequests(): int
    {
        return Http::recorded(fn (Request $r): bool => str_ends_with($r->url(), '/oauth/token'))->count();
    }

    private function assertUnavailable(callable $call): void
    {
        try {
            $call();
            $this->fail('Expected SourceUnavailableException');
        } catch (SourceUnavailableException $e) {
            $this->assertSame('mercadolibre', $e->sourceKey);
            $this->assertStringNotContainsString('app-secret', $e->getMessage());
            $this->assertStringNotContainsString('tok-123', $e->getMessage());
        }
    }

    public function test_gets_a_token_then_searches_and_maps_the_listings(): void
    {
        $this->fakeOk();

        $listings = $this->source()->search(new ListingQuery('argo'));

        $this->assertCount(1, $listings);
        $this->assertSame('MLA1', $listings[0]->externalId);
        Http::assertSent(fn (Request $r): bool => str_ends_with($r->url(), '/oauth/token')
            && $r['grant_type'] === 'client_credentials'
            && $r['client_id'] === 'app-id'
            && $r['client_secret'] === 'app-secret');
        Http::assertSent(fn (Request $r): bool => str_starts_with($r->url(), self::BASE.'/sites/MLA/search')
            && $r->hasHeader('Authorization', 'Bearer tok-123')
            && str_contains($r->url(), 'category=MLA1744')
            && str_contains($r->url(), 'limit=50')
            && str_contains($r->url(), 'q=argo'));
    }

    public function test_omits_q_when_there_is_no_text(): void
    {
        $this->fakeOk();

        $this->source()->search(new ListingQuery);

        Http::assertSent(fn (Request $r): bool => str_contains($r->url(), '/search') && ! str_contains($r->url(), 'q='));
    }

    public function test_caches_the_token_between_searches(): void
    {
        $this->fakeOk();
        $source = $this->source();

        $source->search(new ListingQuery);
        $source->search(new ListingQuery('fiat'));

        $this->assertSame(1, $this->tokenRequests());
    }

    public function test_search_rejection_is_unavailable(): void
    {
        Http::fake([
            self::BASE.'/oauth/token' => Http::response(['access_token' => 'tok-123', 'expires_in' => 21600]),
            self::BASE.'/sites/MLA/search*' => Http::response(['message' => 'forbidden'], 403),
        ]);

        $this->assertUnavailable(fn () => $this->source()->search(new ListingQuery));
    }

    public function test_token_failure_is_unavailable(): void
    {
        Http::fake([self::BASE.'/oauth/token' => Http::response(['error' => 'invalid_client'], 400)]);

        $this->assertUnavailable(fn () => $this->source()->search(new ListingQuery));
        Http::assertNotSent(fn (Request $r): bool => str_contains($r->url(), '/search'));
    }

    public function test_token_response_without_access_token_is_unavailable(): void
    {
        Http::fake([self::BASE.'/oauth/token' => Http::response(['expires_in' => 10])]);

        $this->assertUnavailable(fn () => $this->source()->search(new ListingQuery));
    }

    public function test_connection_failure_is_unavailable(): void
    {
        Http::fake(fn () => throw new ConnectionException('cURL error 28: timed out'));

        $this->assertUnavailable(fn () => $this->source()->search(new ListingQuery));
    }

    public function test_malformed_search_body_is_unavailable(): void
    {
        Http::fake([
            self::BASE.'/oauth/token' => Http::response(['access_token' => 'tok-123', 'expires_in' => 21600]),
            self::BASE.'/sites/MLA/search*' => Http::response(['unexpected' => true]),
        ]);

        $this->assertUnavailable(fn () => $this->source()->search(new ListingQuery));
    }

    public function test_missing_credentials_fail_without_any_http_call(): void
    {
        Http::fake();

        $this->assertUnavailable(fn () => $this->source('', '')->search(new ListingQuery));
        Http::assertNothingSent();
    }

    public function test_a_401_on_search_forgets_the_cached_token(): void
    {
        Http::fake([
            self::BASE.'/oauth/token' => Http::response(['access_token' => 'tok-123', 'expires_in' => 21600]),
            self::BASE.'/sites/MLA/search*' => Http::response([], 401),
        ]);
        $source = $this->source();

        $this->assertUnavailable(fn () => $source->search(new ListingQuery));
        $this->assertUnavailable(fn () => $source->search(new ListingQuery));

        $this->assertSame(2, $this->tokenRequests());
    }
}
