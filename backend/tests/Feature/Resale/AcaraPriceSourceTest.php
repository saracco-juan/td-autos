<?php

namespace Tests\Feature\Resale;

use App\Services\Resale\AcaraPriceSource;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Fixtures\AcaraPdf;
use Tests\TestCase;

class AcaraPriceSourceTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'https://api.acara.org.ar/api/v1/prices/download-vehicule-processed-pdf?file=acara_precios.pdf';

    protected function setUp(): void
    {
        parent::setUp();
        config(['cache.default' => 'array']);
        Cache::flush();
        Http::preventStrayRequests();
        $this->travelTo(now()->parse('2026-10-21T12:00:00Z'));
    }

    public function test_hu05_command_stores_complete_snapshot_without_merging_duplicate_labels(): void
    {
        $this->assertSame('acara_unavailable', app(AcaraPriceSource::class)->current()['warning']);
        Http::assertNothingSent();
        $pdf = $this->pdf();
        Http::fake([self::URL => Http::response($pdf)]);
        $this->artisan('acara:refresh')->expectsOutput('ACARA: ready (2 rows).')->assertSuccessful();
        $state = app(AcaraPriceSource::class)->current();
        $snapshot = $state['snapshot'];
        $this->assertFalse($state['stale']);
        $this->assertNull($state['warning']);
        $this->assertSame('ACARA', $snapshot['source']);
        $this->assertSame(self::URL, $snapshot['source_url']);
        $this->assertSame('2026-10-19', $snapshot['source_date']);
        $this->assertSame(hash('sha256', $pdf), $snapshot['sha256']);
        $this->assertSame('2026-10-21T12:00:00.000000Z', $snapshot['fetched_at']);
        $this->assertSame($snapshot['rows'][0]['version_id'], $snapshot['rows'][1]['version_id']);
        $this->assertSame(['19800000', '21000000'], array_column(array_column($snapshot['rows'], 'values'), 2024));
        $this->assertNull($snapshot['rows'][0]['zero_km_price']);
    }

    public function test_refresh_is_claimed_once_and_rechecks_at_fourteen_days_exactly(): void
    {
        Http::fakeSequence()->push($this->pdf())->push($this->pdf());
        $first = app(AcaraPriceSource::class)->refresh();
        $this->travel(1209599)->seconds();
        $this->assertSame($first, app(AcaraPriceSource::class)->refresh());
        Http::assertSentCount(1);
        $this->travel(1)->seconds();
        $next = app(AcaraPriceSource::class)->refresh();
        $this->assertSame($first['snapshot']['snapshot_id'], $next['snapshot']['snapshot_id']);
        $this->assertSame($first['snapshot']['rows'], $next['snapshot']['rows']);
        $this->assertNotSame($first['snapshot']['fetched_at'], $next['snapshot']['fetched_at']);
        Http::assertSentCount(2);
    }

    #[DataProvider('failures')]
    public function test_failed_refresh_preserves_every_previous_row(string $case): void
    {
        $body = match ($case) {
            'older' => $this->pdf('18/10/2026'),
            'future' => $this->pdf('11/11/2026'),
            'oversized' => str_repeat('x', 25 * 1024 * 1024 + 1),
            default => '<html>Unavailable</html>',
        };
        Http::fakeSequence()->push($this->pdf())->pushResponse($case === 'connection' ? Http::failedConnection() : Http::response($body, $case === '503' ? 503 : ($case === 'redirect' ? 302 : 200)));
        $first = app(AcaraPriceSource::class)->refresh()['snapshot'];
        $this->travel(14)->days();
        $this->artisan('acara:refresh')->expectsOutput('ACARA: acara_stale (2 rows).')->assertFailed();
        $state = app(AcaraPriceSource::class)->refresh();
        $this->assertSame($first, $state['snapshot']);
        $this->assertTrue($state['stale']);
        $this->assertSame('acara_stale', $state['warning']);
        Http::assertSentCount(2);
    }

    public static function failures(): array
    {
        return array_map(fn ($case) => [$case], ['503', 'redirect', 'invalid', 'older', 'future', 'oversized', 'connection']);
    }

    public function test_first_failure_is_explicit_and_overlapping_caller_cannot_download(): void
    {
        Http::fake(function () {
            $this->assertNull(app(AcaraPriceSource::class)->refresh()['snapshot']);

            return Http::response('', 503);
        });
        $this->artisan('acara:refresh')->expectsOutput('ACARA: acara_unavailable (0 rows).')->assertFailed();
        $this->assertSame('acara_unavailable', app(AcaraPriceSource::class)->refresh()['warning']);
        Http::assertSentCount(1);
    }

    public function test_database_snapshot_survives_cache_manager_recreation(): void
    {
        config(['cache.default' => 'database']);
        Http::fake([self::URL => Http::response($this->pdf())]);
        $first = app(AcaraPriceSource::class)->refresh();
        app()->forgetInstance('cache');
        Cache::clearResolvedInstance('cache');
        $this->assertSame($first, app(AcaraPriceSource::class)->refresh());
        Http::assertSentCount(1);
    }

    public function test_download_options_and_progress_guard_and_bounded_schedule(): void
    {
        Http::fake(function ($request, $options) {
            $this->assertSame(self::URL, $request->url());
            $this->assertTrue($options['verify']);
            $this->assertFalse($options['allow_redirects']);
            $this->assertFalse($options['decode_content']);
            $this->assertSame(60, $options['timeout']);
            $this->assertSame(20, $options['connect_timeout']);
            $this->assertTrue(is_resource($options['sink']));
            ($options['progress'])(0, 25 * 1024 * 1024 + 1, 0, 0);
            $this->fail('Oversized streaming download was not aborted.');
        });
        $this->assertSame('acara_unavailable', app(AcaraPriceSource::class)->refresh()['warning']);
        $events = app(Schedule::class)->events();
        $event = collect($events)->first(fn ($event) => str_contains($event->command, 'acara:refresh'));
        $this->assertSame('0 0 * * *', $event->expression);
        $this->assertStringContainsString('memory_limit=512M', $event->command);
        $this->assertStringContainsString('max_execution_time=120', $event->command);
        $this->assertTrue($event->withoutOverlapping);
        $this->assertSame('0 * * * *', collect($events)->first(fn ($event) => str_contains($event->command, 'suscripciones:procesar'))->expression);
    }

    private function pdf(string $date = '19/10/2026'): string
    {
        return AcaraPdf::make($date);
    }
}
