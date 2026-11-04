<?php

namespace Tests\Feature\ExchangeRates;

use App\Services\ExchangeRates\DolarApi;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DolarApiTest extends TestCase
{
    private const URL = 'https://dolarapi.com/v1/dolares/oficial';

    protected function setUp(): void
    {
        parent::setUp();
        config(['cache.default' => 'array']);
        Cache::flush();
        Http::preventStrayRequests();
        $this->travelTo(Carbon::parse('2026-10-20T12:00:00Z'));
    }

    private function payload(array $changes = []): array
    {
        return array_replace(['moneda' => 'USD', 'casa' => 'oficial', 'nombre' => 'Oficial',
            'compra' => 1495, 'venta' => 1545, 'fechaActualizacion' => '2026-10-20T12:00:00.000Z'], $changes);
    }

    private function current(): array
    {
        return app(DolarApi::class)->current();
    }

    public function test_official_sell_quote_has_attribution_and_distinct_provider_and_fetch_times(): void
    {
        Http::fake([self::URL => Http::response($this->payload())]);
        $result = $this->current();
        $this->assertFalse($result['stale']);
        $this->assertNull($result['warning']);
        $this->assertSame(1545.0, $result['quote']['sell']);
        $this->assertSame('DolarAPI', $result['quote']['source']);
        $this->assertSame('https://dolarapi.com', $result['quote']['source_url']);
        $this->assertSame('Ámbito Financiero', $result['quote']['upstream_source']);
        $this->assertSame('2026-10-20T12:00:00.000000Z', $result['quote']['updated_at']);
        $this->assertSame('2026-10-20T12:00:00.000000Z', $result['quote']['fetched_at']);
        Http::assertSent(fn ($request) => $request->method() === 'GET' && $request->url() === self::URL
            && $request->hasHeader('Accept', 'application/json'));
    }

    public function test_cache_survives_service_instances_and_refreshes_at_three_hours_exactly(): void
    {
        Http::fakeSequence()->push($this->payload())->push($this->payload([
            'venta' => 1550, 'fechaActualizacion' => '2026-10-20T15:00:00.000Z',
        ]));
        $first = $this->current();
        $this->travel(10799)->seconds();
        $this->assertSame($first, $this->current());
        Http::assertSentCount(1);
        $this->travel(1)->seconds();
        $next = $this->current();
        $this->assertSame(1550.0, $next['quote']['sell']);
        $this->assertSame('2026-10-20T15:00:00.000000Z', $next['quote']['fetched_at']);
        Http::assertSentCount(2);
    }

    #[DataProvider('invalidResponses')]
    public function test_invalid_or_failed_response_preserves_last_valid_quote(array|string $payload, int $status = 200): void
    {
        Http::fakeSequence()->push($this->payload())->push($payload, $status);
        $first = $this->current();
        $this->travel(3)->hours();
        $fallback = $this->current();
        $this->assertSame($first['quote'], $fallback['quote']);
        $this->assertTrue($fallback['stale']);
        $this->assertSame('exchange_rate_stale', $fallback['warning']);
        $this->assertSame($fallback, $this->current());
        Http::assertSentCount(2);
    }

    public static function invalidResponses(): array
    {
        $valid = ['moneda' => 'USD', 'casa' => 'oficial', 'venta' => 1545,
            'fechaActualizacion' => '2026-10-20T15:00:00.000Z'];
        $cases = [['{}', 503], ['{}', 429], ['{}', 302], ['{', 200], [[], 200]];
        foreach (['venta' => [0, -1, true, '1545', null], 'moneda' => ['EUR'], 'casa' => ['blue'],
            'fechaActualizacion' => [null, 'today', '2026-02-30T12:00:00Z', '2026-10-21T00:00:00Z']] as $field => $values) {
            foreach ($values as $value) {
                $cases[] = [array_replace($valid, [$field => $value])];
            }
        }

        return $cases;
    }

    public function test_connection_failure_without_history_returns_unavailable_and_is_throttled(): void
    {
        $attempts = 0;
        Http::fake(function () use (&$attempts) {
            $attempts++;

            throw new ConnectionException('timeout');
        });
        $expected = ['quote' => null, 'stale' => false, 'warning' => 'exchange_rate_unavailable'];
        $this->assertSame($expected, $this->current());
        $this->assertSame($expected, $this->current());
        $this->assertSame(1, $attempts);
    }

    public function test_first_invalid_response_does_not_invent_a_quote_and_recovers_after_the_window(): void
    {
        Http::fakeSequence()->push(['venta' => 1545])->push($this->payload());
        $this->assertSame(['quote' => null, 'stale' => false, 'warning' => 'exchange_rate_unavailable'], $this->current());
        $this->assertNull($this->current()['quote']);
        Http::assertSentCount(1);
        $this->travel(3)->hours();
        $this->assertSame(1545.0, $this->current()['quote']['sell']);
        Http::assertSentCount(2);
    }

    public function test_old_quote_survives_days_of_failures_then_recovers_without_changing_its_original_date(): void
    {
        Http::fakeSequence()->push($this->payload())->pushStatus(500)->push($this->payload());
        $first = $this->current();
        $this->travel(4)->days();
        $this->assertSame($first['quote'], $this->current()['quote']);
        $this->travel(3)->hours();
        $recovered = $this->current();
        $this->assertFalse($recovered['stale']);
        $this->assertNull($recovered['warning']);
        $this->assertSame($first['quote']['updated_at'], $recovered['quote']['updated_at']);
        $this->assertNotSame($first['quote']['fetched_at'], $recovered['quote']['fetched_at']);
        Http::assertSentCount(3);
    }

    public function test_provider_cannot_replace_a_newer_quote_with_an_older_one(): void
    {
        Http::fakeSequence()->push($this->payload())->push($this->payload([
            'venta' => 1, 'fechaActualizacion' => '2026-10-19T12:00:00.000Z',
        ]));
        $first = $this->current();
        $this->travel(3)->hours();
        $this->assertSame($first['quote'], $this->current()['quote']);
        $this->assertTrue($this->current()['stale']);
        Http::assertSentCount(2);
    }

    #[DataProvider('warmCache')]
    public function test_overlapping_call_uses_snapshot_without_a_duplicate_provider_request(bool $warm): void
    {
        $previous = null;
        if ($warm) {
            Http::fake([self::URL => Http::response($this->payload())]);
            $previous = $this->current()['quote'];
            $this->travel(3)->hours();
        }
        $nested = null;
        Http::fake(function () use (&$nested) {
            $nested = $this->current();

            return Http::response($this->payload(['fechaActualizacion' => now()->toISOString()]));
        });
        $this->assertFalse($this->current()['stale']);
        $this->assertSame($previous, $nested['quote']);
        $this->assertSame($warm, $nested['stale']);
        Http::assertSentCount(1);
    }

    public static function warmCache(): array
    {
        return [[false], [true]];
    }
}
