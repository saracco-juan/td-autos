<?php

namespace Tests\Feature\Resale;

use App\Services\Resale\DnrpaActivityCalculator;
use App\Services\Resale\DnrpaActivityStore;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;
use ZipArchive;

class DnrpaActivityStoreTest extends TestCase
{
    use RefreshDatabase;

    private string $month = '202609';

    private bool $fail = false;

    private bool $superseded = false;

    private ?array $overlap = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->parse('2026-10-21T12:00:00Z'));
        config(['cache.default' => 'array']);
        Http::preventStrayRequests();
        Cache::forever('resale.acara.last-valid.v1', ['snapshot_id' => 'catalog-1', 'fetched_at' => now()->toISOString(),
            'rows' => [['make' => 'Toyota', 'model' => 'Corolla', 'version' => 'XLI']]]);
        Http::fake(function ($request) {
            if ($this->fail) {
                return Http::response('', 503);
            }
            if (str_contains($request->url(), 'package_show')) {
                if ($this->superseded) {
                    DB::table('dnrpa_refresh_state')->where('id', 1)->update(['attempted_at' => now()->addSecond()]);
                }
                // A second caller during network I/O must not acquire the same attempt.
                $this->overlap = app(DnrpaActivityStore::class)->refresh();
                $root = 'https://datos.jus.gob.ar/dataset/f6932e82-a039-4462-968d-7dcda77d1a3e/resource/1bde10bd-0067-4f1d-8e8e-e73ca2dec57f/download/dnrpa-transferencias-autos-';

                return Http::response(['success' => true, 'result' => ['id' => 'f6932e82-a039-4462-968d-7dcda77d1a3e', 'resources' => [
                    ['name' => 'DNRPA. Transferencias de autos - '.$this->month, 'format' => 'CSV', 'url' => $root.$this->month.'.csv'],
                    ['name' => 'DNRPA. Transferencias de autos - 2026', 'format' => 'ZIP', 'url' => $root.'2026.zip'],
                ]]]);
            }

            return Http::response($this->archive());
        });
    }

    public function test_hu05_current_and_history_are_local_and_initially_unavailable(): void
    {
        $this->assertSame(['snapshot' => null, 'checked_at' => null, 'stale' => false, 'warning' => 'dnrpa_unavailable'], app(DnrpaActivityStore::class)->current());
        $this->assertSame([], app(DnrpaActivityStore::class)->history());
        $this->assertDatabaseCount('dnrpa_refresh_state', 0);
        Http::assertNothingSent();
    }

    public function test_command_publishes_dated_aggregate_history_and_claims_before_io(): void
    {
        $this->artisan('dnrpa:refresh')->expectsOutput('DNRPA: ready (2026-09).')->assertSuccessful();
        $state = app(DnrpaActivityStore::class)->current();
        $this->assertNull($state['warning']);
        $this->assertSame('2026-10-21T12:00:00.000000Z', $state['snapshot']['fetched_at']);
        $this->assertSame(6, $state['snapshot']['activity']['transfers']);
        $this->assertSame('dnrpa_unavailable', $this->overlap['warning']);
        $this->assertCount(6, $state['snapshot']['snapshots']);
        $this->assertStringNotContainsString('PRIVATE_HOLDER', json_encode(app(DnrpaActivityStore::class)->history()));
        Cache::flush();
        $this->assertSame($state, (new DnrpaActivityStore)->current());
        $this->assertCount(1, (new DnrpaActivityStore)->history());
        Http::assertSentCount(2);
    }

    public function test_fourteen_day_boundary_checks_metadata_only_when_month_is_unchanged(): void
    {
        $store = new DnrpaActivityStore;
        $first = $store->refresh()['snapshot'];
        $this->travel(1209599)->seconds();
        $store->refresh();
        Http::assertSentCount(2);
        $this->travel(1)->seconds();
        $next = $store->refresh();
        $this->assertSame($first, $next['snapshot']);
        $this->assertSame('2026-11-04T12:00:00.000000Z', $next['checked_at']);
        $this->assertFalse($next['stale']);
        $this->assertDatabaseCount('dnrpa_activity_history', 1);
        Http::assertSentCount(3);
    }

    public function test_new_month_appends_history_without_overwriting_previous_aggregates(): void
    {
        $store = new DnrpaActivityStore;
        $first = $store->refresh()['snapshot'];
        $this->month = '202610';
        $this->travel(14)->days();
        $this->assertSame('2026-10', $store->refresh()['snapshot']['activity']['window_end']);
        $this->assertSame($first, $store->history()['2026-09']);
        $this->assertSame(['2026-09', '2026-10'], array_keys($store->history()));
        Http::assertSentCount(4);
    }

    public function test_failed_refresh_keeps_last_good_and_throttles_failed_attempts(): void
    {
        $store = new DnrpaActivityStore;
        $first = $store->refresh()['snapshot'];
        $this->travel(14)->days();
        $this->fail = true;
        $this->artisan('dnrpa:refresh')->expectsOutput('DNRPA: dnrpa_stale (2026-09).')->assertFailed();
        $state = $store->refresh();
        $this->assertSame($first, $state['snapshot']);
        $this->assertTrue($state['stale']);
        $this->assertDatabaseCount('dnrpa_activity_history', 1);
        Http::assertSentCount(3);
    }

    public function test_missing_catalog_preserves_unavailable_state_without_http(): void
    {
        Cache::flush();
        $this->artisan('dnrpa:refresh')->expectsOutput('DNRPA: dnrpa_unavailable (none).')->assertFailed();
        $this->assertSame('dnrpa_unavailable', app(DnrpaActivityStore::class)->refresh()['warning']);
        $this->assertDatabaseCount('dnrpa_activity_history', 0);
        Http::assertNothingSent();
    }

    public function test_superseded_attempt_cannot_publish_or_mark_a_successful_check(): void
    {
        $this->superseded = true;
        $state = (new DnrpaActivityStore)->refresh();
        $this->assertSame('dnrpa_unavailable', $state['warning']);
        $this->assertNull($state['checked_at']);
        $this->assertDatabaseCount('dnrpa_activity_history', 0);
        Http::assertSentCount(2);
    }

    public function test_failed_publication_rolls_back_history_and_success_timestamp(): void
    {
        $store = new DnrpaActivityStore;
        $first = $store->refresh();
        $this->travel(14)->days();
        $this->month = '202610';
        DB::listen(function ($query) {
            if (str_starts_with($query->sql, 'insert into "dnrpa_activity_history"')) {
                throw new \RuntimeException('Simulated publication failure.');
            }
        });
        $next = $store->refresh();
        $this->assertSame($first['snapshot'], $next['snapshot']);
        $this->assertSame($first['checked_at'], $next['checked_at']);
        $this->assertTrue($next['stale']);
        $this->assertDatabaseCount('dnrpa_activity_history', 1);
    }

    public function test_bounded_daily_worker_does_not_change_existing_schedules(): void
    {
        $events = collect(app(Schedule::class)->events());
        $event = $events->first(fn ($event) => str_contains($event->command, 'dnrpa:refresh'));
        $this->assertSame('0 1 * * *', $event->expression);
        $this->assertStringContainsString('memory_limit=512M', $event->command);
        $this->assertStringContainsString('max_execution_time=600', $event->command);
        $this->assertTrue($event->withoutOverlapping);
        $this->assertSame(15, $event->expiresAt);
        $this->assertSame('0 0 * * *', $events->first(fn ($event) => str_contains($event->command, 'acara:refresh'))->expression);
        $this->assertSame('0 * * * *', $events->first(fn ($event) => str_contains($event->command, 'suscripciones:procesar'))->expression);
        Http::assertNothingSent();
    }

    private function archive(): string
    {
        $file = tempnam(sys_get_temp_dir(), 'dnrpa-history-test-');
        $zip = new ZipArchive;
        $zip->open($file, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $months = (new DnrpaActivityCalculator)->monthsEndingAt(substr($this->month, 0, 4).'-'.substr($this->month, 4), now()->toImmutable());
        foreach ($months as $month) {
            $zip->addFromString('dnrpa-transferencias-autos-'.str_replace('-', '', $month).'.csv', "tramite_fecha,automotor_marca_descripcion,automotor_modelo_descripcion,titular_nombre\n$month-01,Toyota,Corolla,PRIVATE_HOLDER\n");
        }
        $zip->close();
        $bytes = file_get_contents($file);
        unlink($file);

        return $bytes;
    }
}
