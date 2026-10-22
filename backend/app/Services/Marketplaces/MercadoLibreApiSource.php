<?php

namespace App\Services\Marketplaces;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Mercado Libre listings from the live search API, authenticated with an app token
 * (client_credentials). As of 2026-10 the search answers 403 to this app, which surfaces as an
 * unavailable source (RNF06, RNF02).
 */
class MercadoLibreApiSource implements ListingSource
{
    private const TOKEN_CACHE_KEY = 'marketplaces.mercadolibre.token';

    public function __construct(
        private readonly ?string $clientId,
        private readonly ?string $clientSecret,
        private readonly string $baseUrl,
        private readonly string $site,
        private readonly string $category,
        private readonly int $timeout,
        private readonly int $limit,
        private readonly MercadoLibreListingMapper $mapper,
    ) {}

    public function key(): string
    {
        return MercadoLibreListingMapper::KEY;
    }

    public function label(): string
    {
        return 'Mercado Libre';
    }

    public function search(ListingQuery $query): array
    {
        try {
            $response = $this->client()
                ->withToken($this->token())
                ->get("/sites/{$this->site}/search", array_filter([
                    'category' => $this->category,
                    'limit' => $this->limit,
                    'q' => $query->text,
                ]));
        } catch (ConnectionException) {
            throw $this->unavailable('connection failed or timed out');
        }

        if ($response->status() === 401) {
            Cache::forget(self::TOKEN_CACHE_KEY);
        }

        if (! $response->successful()) {
            throw $this->unavailable('search answered HTTP '.$response->status());
        }

        $body = $response->json();

        return $this->mapper->mapResponse(is_array($body) ? $body : []);
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl($this->baseUrl)->acceptJson()->timeout($this->timeout);
    }

    private function token(): string
    {
        if (blank($this->clientId) || blank($this->clientSecret)) {
            throw $this->unavailable('credentials are not configured');
        }

        $cached = Cache::get(self::TOKEN_CACHE_KEY);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        try {
            $response = $this->client()->asForm()->post('/oauth/token', [
                'grant_type' => 'client_credentials',
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
            ]);
        } catch (ConnectionException) {
            throw $this->unavailable('token request failed to connect');
        }

        $token = $response->json('access_token');
        if (! $response->successful() || ! is_string($token) || $token === '') {
            throw $this->unavailable('token request answered HTTP '.$response->status());
        }

        $ttl = max(0, (int) $response->json('expires_in', 0) - 60);
        if ($ttl > 0) {
            Cache::put(self::TOKEN_CACHE_KEY, $token, $ttl);
        }

        return $token;
    }

    private function unavailable(string $reason): SourceUnavailableException
    {
        return new SourceUnavailableException($this->key(), $reason);
    }
}
