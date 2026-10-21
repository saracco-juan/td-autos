<?php

namespace Tests\Feature\Internal;

use App\Models\Concesionaria;
use App\Models\Suscripcion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * The hourly subscription job triggered from outside (the free host has no cron).
 */
class SubscriptionCronTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/internal/cron/subscriptions';

    private function expiredSubscription(): Suscripcion
    {
        return Suscripcion::factory()->create([
            'concesionaria_id' => Concesionaria::factory()->active(),
            'estado' => Suscripcion::ESTADO_ACTIVA,
            'vigente_desde' => '2026-09-01',
            'vigente_hasta' => '2026-10-01',
        ]);
    }

    public function test_endpoint_is_disabled_when_no_secret_is_configured(): void
    {
        config(['cron.secret' => null]);
        $subscription = $this->expiredSubscription();
        $this->travelTo('2026-10-14 15:00:00');

        $this->postJson(self::URL, [], ['Authorization' => 'Bearer anything'])->assertNotFound();

        $this->assertSame(Suscripcion::ESTADO_ACTIVA, $subscription->fresh()->estado);
    }

    public function test_wrong_or_missing_token_is_rejected(): void
    {
        config(['cron.secret' => 'expected-secret']);
        $subscription = $this->expiredSubscription();
        $this->travelTo('2026-10-14 15:00:00');

        $this->postJson(self::URL, [], ['Authorization' => 'Bearer wrong-secret'])->assertUnauthorized();
        $this->postJson(self::URL)->assertUnauthorized();

        $this->assertSame(Suscripcion::ESTADO_ACTIVA, $subscription->fresh()->estado);
    }

    public function test_valid_token_runs_the_subscription_processing(): void
    {
        config(['cron.secret' => 'expected-secret']);
        $subscription = $this->expiredSubscription();
        $this->travelTo('2026-10-14 15:00:00');

        $this->postJson(self::URL, [], ['Authorization' => 'Bearer expected-secret'])
            ->assertOk()
            ->assertExactJson(['inactivated_subscriptions' => 1, 'deleted_vehicles' => 0]);

        $this->assertSame(Suscripcion::ESTADO_INACTIVA, $subscription->fresh()->estado);
    }

    public function test_endpoint_runs_outside_the_session_and_csrf_middleware(): void
    {
        // CSRF is skipped while running tests, so assert the route is not in the web group instead.
        $route = app('router')->getRoutes()->match(Request::create(self::URL, 'POST'));

        $this->assertNotContains('web', $route->gatherMiddleware());
    }
}
