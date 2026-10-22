<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LogoutTest extends TestCase
{
    use RefreshDatabase;

    private function login(User $user): void
    {
        $this->postJson('/login', ['email' => $user->email, 'password' => 'password'])->assertNoContent();

        // Drop the guard cached in this test process so follow-up requests resolve the user from the session.
        $this->app['auth']->forgetGuards();
    }

    // TC-83
    public function test_logout_ends_the_session(): void
    {
        $user = User::factory()->create();
        $this->login($user);
        $this->getJson('/api/user')->assertOk()->assertJsonPath('email', $user->email);

        $this->postJson('/logout')->assertNoContent();

        // The /api/user request above left the cached sanctum guard as default; logout acts on the session guard.
        $this->assertGuest('web');
    }

    // TC-84
    public function test_protected_endpoint_is_unauthorized_after_logout(): void
    {
        $this->login(User::factory()->create());
        $this->postJson('/logout')->assertNoContent();
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_protected_endpoint_is_unauthorized_without_a_session(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_logout_without_a_session_is_unauthorized(): void
    {
        $this->postJson('/logout')->assertUnauthorized();
    }
}
