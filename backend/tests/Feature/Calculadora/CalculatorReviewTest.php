<?php

namespace Tests\Feature\Calculadora;

use App\Models\CalculatorRefreshSnapshot;
use App\Services\Calculadora\CalculatorReview;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CalculatorReviewTest extends TestCase
{
    use RefreshDatabase;

    private const OLD_SOURCE = 'https://old.example.test/scale';

    private const FRESH_SOURCE = 'https://fresh.example.test/rates';

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-11-01T08:00:00Z'));
        config(['calculadora.review' => [
            'max_age_months' => 12,
            'snapshot_max_age_days' => 40,
            'groups' => [
                'patente_scale' => [
                    'label' => 'Escalas de patente',
                    'config_path' => 'patente.scale',
                    'reviewed_at' => '2025-10-31',
                    'sources' => [self::OLD_SOURCE],
                ],
                'insurance_zones' => [
                    'label' => 'Factores de zona del seguro',
                    'config_path' => 'insurance.zone_factor',
                    'reviewed_at' => '2026-10-24',
                    'sources' => [self::FRESH_SOURCE, self::OLD_SOURCE],
                ],
            ],
        ]]);
        Http::preventStrayRequests();
    }

    private function allSourcesAnswer(): void
    {
        Http::fake(['*' => Http::response('ok', 200)]);
    }

    private function snapshot(string $fetchedAt, string $status = 'valid'): void
    {
        CalculatorRefreshSnapshot::create(['fetched_at' => $fetchedAt, 'status' => $status, 'payload' => ['fuel' => null, 'cpi' => null]]);
    }

    public function test_a_group_is_stale_after_twelve_months_and_fresh_before(): void
    {
        $this->allSourcesAnswer();
        $review = app(CalculatorReview::class)->run();

        $this->assertSame(['patente_scale'], array_column($review['stale'], 'key'));
        $this->assertSame(['insurance_zones'], array_column($review['fresh'], 'key'));
        $this->assertSame('patente.scale', $review['stale'][0]['config_path']);
        $this->assertSame('2025-10-31', $review['stale'][0]['reviewed_at']);
        $this->assertSame([self::OLD_SOURCE], $review['stale'][0]['sources']);
        $this->assertSame(now()->toIso8601String(), $review['generated_at']);
    }

    public function test_exactly_twelve_months_old_is_still_fresh_and_the_threshold_is_configurable(): void
    {
        $this->allSourcesAnswer();
        $this->travelTo(Carbon::parse('2026-10-31T08:00:00Z'));
        $this->assertSame([], app(CalculatorReview::class)->run()['stale']);

        config(['calculadora.review.max_age_months' => 6]);
        $this->assertSame(['patente_scale'], array_column(app(CalculatorReview::class)->run()['stale'], 'key'));
    }

    public function test_unreachable_sources_are_reported_once_with_the_groups_that_use_them(): void
    {
        Http::fake([
            'old.example.test/*' => Http::response('gone', 404),
            'fresh.example.test/*' => fn () => throw new ConnectionException('timeout'),
        ]);

        $unreachable = collect(app(CalculatorReview::class)->run()['unreachable_sources'])->keyBy('url');

        $this->assertCount(2, $unreachable);
        $this->assertSame(404, $unreachable[self::OLD_SOURCE]['status']);
        $this->assertSame(['Escalas de patente', 'Factores de zona del seguro'], $unreachable[self::OLD_SOURCE]['groups']);
        $this->assertNull($unreachable[self::FRESH_SOURCE]['status']);
        $this->assertNotEmpty($unreachable[self::FRESH_SOURCE]['error']);
    }

    public function test_answering_sources_and_redirects_are_not_reported(): void
    {
        Http::fake([
            'old.example.test/*' => Http::response('', 301, ['Location' => 'https://elsewhere.example.test']),
            'elsewhere.example.test*' => Http::response('ok', 200),
            'fresh.example.test/*' => Http::response('ok', 200),
        ]);

        $this->assertSame([], app(CalculatorReview::class)->run()['unreachable_sources']);
    }

    public function test_the_snapshot_age_is_reported(): void
    {
        $this->allSourcesAnswer();
        $this->assertSame(['latest_fetched_at' => null, 'age_days' => null, 'stale' => true], app(CalculatorReview::class)->run()['snapshot']);

        $this->snapshot('2026-09-21T07:00:00Z'); // 41 days
        $this->snapshot('2026-10-30T07:00:00Z', 'failed'); // failed attempts do not count
        $snapshot = app(CalculatorReview::class)->run()['snapshot'];
        $this->assertSame(41, $snapshot['age_days']);
        $this->assertTrue($snapshot['stale']);

        $this->snapshot('2026-10-10T07:00:00Z');
        $snapshot = app(CalculatorReview::class)->run()['snapshot'];
        $this->assertSame(22, $snapshot['age_days']);
        $this->assertFalse($snapshot['stale']);
    }

    public function test_it_never_writes(): void
    {
        $this->allSourcesAnswer();
        $this->snapshot('2026-10-10T07:00:00Z');
        app(CalculatorReview::class)->run();

        $this->assertSame(1, CalculatorRefreshSnapshot::count());
    }

    public function test_the_markdown_lists_a_stale_group_with_its_links(): void
    {
        Http::fake(['old.example.test/*' => Http::response('gone', 404), '*' => Http::response('ok')]);
        $service = app(CalculatorReview::class);

        $markdown = $service->markdown($service->run());

        $this->assertStringContainsString('- [ ] **Escalas de patente**', $markdown);
        $this->assertStringContainsString('`patente.scale`', $markdown);
        $this->assertStringContainsString('2025-10-31', $markdown);
        $this->assertStringContainsString(self::OLD_SOURCE, $markdown);
        $this->assertStringNotContainsString('- [ ] **Factores de zona del seguro**', $markdown);
        $this->assertStringContainsString('Fuentes que no responden', $markdown);
        $this->assertStringContainsString('HTTP 404', $markdown);
        $this->assertStringContainsString('Sin snapshot válido', $markdown);
        $this->assertStringContainsString('docs/development/calculator.md', $markdown);
    }

    public function test_the_markdown_says_everything_is_up_to_date_when_nothing_is_stale(): void
    {
        $this->allSourcesAnswer();
        config(['calculadora.review.groups.patente_scale.reviewed_at' => '2026-10-01']);
        $this->snapshot('2026-10-10T07:00:00Z');
        $service = app(CalculatorReview::class);

        $markdown = $service->markdown($service->run());

        $this->assertStringContainsString('Todo al día', $markdown);
        $this->assertStringNotContainsString('- [ ]', $markdown);
        $this->assertStringNotContainsString('Fuentes que no responden', $markdown);
    }

    public function test_the_cron_endpoint_is_disabled_without_a_secret_and_rejects_a_wrong_token(): void
    {
        $this->allSourcesAnswer();
        config(['cron.secret' => null]);
        $this->postJson('/internal/cron/calculadora-revision', [], ['Authorization' => 'Bearer x'])->assertNotFound();

        config(['cron.secret' => 'right']);
        $this->postJson('/internal/cron/calculadora-revision', [], ['Authorization' => 'Bearer wrong'])->assertUnauthorized();
        Http::assertNothingSent();
    }

    public function test_the_cron_endpoint_returns_the_review_and_a_markdown_checklist(): void
    {
        $this->allSourcesAnswer();
        config(['cron.secret' => 'right']);

        $this->postJson('/internal/cron/calculadora-revision', [], ['Authorization' => 'Bearer right'])->assertOk()
            ->assertJsonPath('title', 'Revisión anual de valores de la calculadora (2026)')
            ->assertJsonPath('stale.0.key', 'patente_scale')
            ->assertJsonPath('fresh.0.key', 'insurance_zones')
            ->assertJsonPath('unreachable_sources', [])
            ->assertJsonPath('snapshot.stale', true)
            ->assertJson(fn ($json) => $json->has('generated_at')->where('markdown', fn ($md) => str_contains($md, '- [ ] **Escalas de patente**'))->etc());
    }

    public function test_the_command_prints_a_summary_and_always_succeeds(): void
    {
        Http::fake(['*' => Http::response('gone', 500)]);

        $this->artisan('calculadora:review')
            ->expectsOutputToContain('Escalas de patente')
            ->expectsOutputToContain('Stale: 1')
            ->assertSuccessful();
    }

    public function test_the_review_command_is_scheduled_yearly_without_overlap(): void
    {
        $event = collect(app(Schedule::class)->events())
            ->first(fn ($event) => str_contains($event->command, 'calculadora:review'));

        $this->assertNotNull($event, 'calculadora:review is not scheduled.');
        $this->assertSame('0 5 1 1 *', $event->expression);
        $this->assertSame('America/Argentina/Buenos_Aires', (string) $event->timezone);
        $this->assertTrue($event->withoutOverlapping);
    }

    public function test_the_real_config_declares_every_review_group_with_a_valid_date_and_path(): void
    {
        $this->travelBack();
        $config = require base_path('config/calculadora.php');
        $groups = $config['review']['groups'];

        $this->assertSame(12, $config['review']['max_age_months']);
        $this->assertGreaterThanOrEqual(14, count($groups));
        foreach ($groups as $key => $group) {
            $this->assertNotSame('', $group['label'], $key);
            $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $group['reviewed_at'], $key);
            $this->assertNotNull(data_get($config, $group['config_path']), "$key points to a missing config path");
            foreach ($group['sources'] as $url) {
                $this->assertStringStartsWith('https://', $url, $key);
            }
        }
    }
}
