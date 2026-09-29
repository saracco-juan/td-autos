<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\InvalidStateException;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class GoogleRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private const FRONTEND = 'http://localhost:5173';

    private function googleUser(string $sub = 'S1', ?string $email = 'g@x.com', bool $verified = true): SocialiteUser
    {
        return (new SocialiteUser)
            ->setRaw([
                'given_name' => 'Gina',
                'family_name' => 'Perez',
                'email_verified' => $verified,
            ])
            ->map(['id' => $sub, 'email' => $email, 'name' => 'Gina Perez']);
    }

    private function mockProvider(): MockInterface
    {
        $provider = Mockery::mock();
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        return $provider;
    }

    public function test_new_google_user_is_registered_and_logged_in(): void
    {
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser());

        $response = $this->get(route('auth.google.callback', ['code' => 'c', 'state' => 's']));

        $response->assertRedirect(self::FRONTEND.'/');
        $this->assertAuthenticated();
        $user = User::where('email', 'g@x.com')->firstOrFail();
        $this->assertSame(User::ROL_COMPRADOR, $user->rol);
        $this->assertSame('google:S1', $user->auth_subject);
        $this->assertNull($user->password);
        $this->assertNotNull($user->email_verified_at);
        $this->assertAuthenticatedAs($user);
    }

    public function test_existing_google_user_logs_in_without_duplicate(): void
    {
        $user = User::factory()->create(['email' => 'g@x.com', 'auth_subject' => 'google:S1']);
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser());

        $response = $this->get(route('auth.google.callback'));

        $response->assertRedirect(self::FRONTEND.'/');
        $this->assertAuthenticatedAs($user);
        $this->assertSame(1, User::count());
    }

    public function test_verified_google_email_links_existing_local_user(): void
    {
        $user = User::factory()->create(['email' => 'g@x.com', 'auth_subject' => null]);
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser());

        $response = $this->get(route('auth.google.callback'));

        $response->assertRedirect(self::FRONTEND.'/');
        $this->assertAuthenticatedAs($user);
        $this->assertSame('google:S1', $user->fresh()->auth_subject);
        $this->assertSame(1, User::count());
    }

    public function test_unverified_google_email_collision_is_rejected(): void
    {
        $user = User::factory()->create(['email' => 'g@x.com', 'auth_subject' => null]);
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser(verified: false));

        $response = $this->get(route('auth.google.callback'));

        $response->assertRedirect(self::FRONTEND.'/registro?error=email_in_use');
        $this->assertGuest();
        $this->assertNull($user->fresh()->auth_subject);
    }

    public function test_denied_permissions_redirect_as_cancelled_without_user(): void
    {
        $provider = $this->mockProvider();
        $provider->shouldReceive('user')->never();

        $response = $this->get(route('auth.google.callback', ['error' => 'access_denied']));

        $response->assertRedirect(self::FRONTEND.'/registro?error=google_cancelled');
        $this->assertGuest();
        $this->assertSame(0, User::count());
    }

    public function test_provider_failures_redirect_as_failed_without_user(): void
    {
        $provider = $this->mockProvider();
        $provider->shouldReceive('user')->twice()->andThrow(new InvalidStateException, new \RuntimeException('boom'));

        foreach (range(1, 2) as $ignored) {
            $this->get(route('auth.google.callback', ['code' => 'c']))
                ->assertRedirect(self::FRONTEND.'/registro?error=google_failed');
        }

        $this->assertGuest();
        $this->assertSame(0, User::count());
    }

    public function test_profile_without_email_redirects_as_failed(): void
    {
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser(email: null));

        $response = $this->get(route('auth.google.callback'));

        $response->assertRedirect(self::FRONTEND.'/registro?error=google_failed');
        $this->assertGuest();
        $this->assertSame(0, User::count());
    }

    public function test_redirect_route_sends_user_to_google(): void
    {
        config(['services.google.redirect' => 'http://localhost/auth/google/callback']);

        $response = $this->get(route('auth.google.redirect'));

        $response->assertRedirectContains('https://accounts.google.com/');
        $this->assertStringContainsString('prompt=select_account', $response->headers->get('Location'));
        $this->assertNotNull(session('state'));
    }

    public function test_google_email_is_stored_lowercase(): void
    {
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser(email: 'G@X.com'));

        $this->get(route('auth.google.callback'))->assertRedirect(self::FRONTEND.'/');

        $this->assertSame('g@x.com', User::firstOrFail()->email);
    }

    public function test_authenticated_user_completing_google_ends_logged_in_as_resolved_account(): void
    {
        $existing = User::factory()->create(['email' => 'other@x.com']);
        $google = User::factory()->create(['email' => 'g@x.com', 'auth_subject' => 'google:S1']);
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser());

        $this->actingAs($existing)->get(route('auth.google.callback'))
            ->assertRedirect(self::FRONTEND.'/');

        $this->assertAuthenticatedAs($google);
    }
}
