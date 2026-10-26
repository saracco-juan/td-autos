<?php

namespace Tests\Feature\Internal;

use App\Services\Resale\DnrpaRefreshLauncher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;
use Tests\TestCase;

/**
 * The daily DNRPA refresh triggered from outside (the free host runs no scheduler).
 */
class DnrpaCronTest extends TestCase
{
    private const URL = '/internal/cron/dnrpa';

    protected function setUp(): void
    {
        parent::setUp();
        Process::fake();
        Cache::lock(DnrpaRefreshLauncher::LOCK)->forceRelease();
    }

    public function test_endpoint_is_disabled_when_no_secret_is_configured(): void
    {
        config(['cron.secret' => null]);

        $this->postJson(self::URL, [], ['Authorization' => 'Bearer anything'])->assertNotFound();

        Process::assertNothingRan();
    }

    public function test_wrong_or_missing_token_is_rejected(): void
    {
        config(['cron.secret' => 'expected-secret']);

        $this->postJson(self::URL, [], ['Authorization' => 'Bearer wrong-secret'])->assertUnauthorized();
        $this->postJson(self::URL)->assertUnauthorized();

        Process::assertNothingRan();
    }

    public function test_valid_token_starts_the_refresh_in_the_background(): void
    {
        config(['cron.secret' => 'expected-secret']);

        $this->postJson(self::URL, [], ['Authorization' => 'Bearer expected-secret'])
            ->assertAccepted()
            ->assertExactJson(['started' => true]);

        Process::assertRanTimes(fn ($process) => str_contains($process->command, 'dnrpa:refresh')
            && str_contains($process->command, 'memory_limit=512M')
            && str_ends_with(trim($process->command), '&'), 1);
    }

    public function test_a_refresh_already_running_is_not_started_twice(): void
    {
        config(['cron.secret' => 'expected-secret']);
        $headers = ['Authorization' => 'Bearer expected-secret'];

        $this->postJson(self::URL, [], $headers)->assertAccepted()->assertExactJson(['started' => true]);
        $this->postJson(self::URL, [], $headers)->assertAccepted()->assertExactJson(['started' => false]);

        Process::assertRanTimes(fn ($process) => str_contains($process->command, 'dnrpa:refresh'), 1);
    }

    public function test_endpoint_runs_outside_the_session_and_csrf_middleware(): void
    {
        $route = app('router')->getRoutes()->match(Request::create(self::URL, 'POST'));

        $this->assertNotContains('web', $route->gatherMiddleware());
    }
}
