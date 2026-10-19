<?php

namespace Tests\Feature\Auth;

use App\Http\Controllers\Mobile\MobileGoogleController;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Testing\TestResponse;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class MobileGoogleTest extends TestCase
{
    use RefreshDatabase;

    private const RETURN_TO = 'tdautos://auth/google';

    private function googleUser(string $email = 'g@x.com', bool $verified = true): SocialiteUser
    {
        return (new SocialiteUser)
            ->setRaw(['given_name' => 'Gina', 'family_name' => 'Perez', 'email_verified' => $verified])
            ->map(['id' => 'S1', 'email' => $email, 'name' => 'Gina Perez']);
    }

    private function mockProvider(): MockInterface
    {
        $provider = Mockery::mock();
        Socialite::shouldReceive('driver')->with('google')->andReturn($provider);

        return $provider;
    }

    /**
     * Session left by the redirect leg of a mobile flow (the test client keeps no cookies between requests).
     *
     * @return array<string, string>
     */
    private function mobileSession(string $returnTo = self::RETURN_TO): array
    {
        return [
            'google_auth_origin' => 'login',
            'google_auth_client' => 'mobile',
            'google_auth_return_to' => $returnTo,
        ];
    }

    /**
     * @param  array<string, string>  $query
     */
    private function callbackFromApp(string $returnTo = self::RETURN_TO, array $query = []): TestResponse
    {
        return $this->withSession($this->mobileSession($returnTo))->get(route('auth.google.callback', $query));
    }

    /**
     * @return array<string, string>
     */
    private function redirectQuery(string $location): array
    {
        parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

        return $query;
    }

    private function issuedCode(): string
    {
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser());

        return $this->redirectQuery($this->callbackFromApp()->headers->get('Location'))['code'];
    }

    public function test_redirect_stores_the_mobile_origin_and_goes_to_google(): void
    {
        $provider = $this->mockProvider();
        $provider->shouldReceive('with')->andReturnSelf();
        $provider->shouldReceive('redirect')->once()->andReturn(redirect()->away('https://accounts.google.com'));

        $this->get(route('auth.google.redirect', ['from' => 'login', 'client' => 'mobile', 'return_to' => self::RETURN_TO]))
            ->assertRedirect('https://accounts.google.com')
            ->assertSessionHas('google_auth_origin', 'login')
            ->assertSessionHas('google_auth_client', 'mobile')
            ->assertSessionHas('google_auth_return_to', self::RETURN_TO);
    }

    // TC-02: a new Google user returns to the app with a one-time code, never a token.
    public function test_callback_redirects_to_the_app_with_a_one_time_code(): void
    {
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser());

        $response = $this->callbackFromApp(query: ['code' => 'c', 'state' => 's']);

        $response->assertRedirectContains(self::RETURN_TO.'?code=')
            ->assertSessionMissing('google_auth_return_to');
        $code = $this->redirectQuery($response->headers->get('Location'))['code'];
        $this->assertGreaterThanOrEqual(64, strlen($code));
        $this->assertGuest('web');
        $user = User::where('email', 'g@x.com')->firstOrFail();
        $this->assertSame(User::ROL_COMPRADOR, $user->rol);
        $this->assertSame(0, $user->tokens()->count());
        $this->assertFalse(Cache::has('mobile_google_code:'.$code), 'only the hash is stored');
    }

    public function test_code_is_appended_to_a_return_to_that_already_has_a_query_string(): void
    {
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser());

        $location = $this->callbackFromApp('tdautos://auth/google?source=login')->headers->get('Location');

        $this->assertStringStartsWith('tdautos://auth/google?source=login&code=', $location);
        $this->assertSame(['source', 'code'], array_keys($this->redirectQuery($location)));
    }

    // TC-02: the code is exchanged for a token and works once.
    public function test_exchange_returns_a_token_and_the_code_is_single_use(): void
    {
        $code = $this->issuedCode();

        $this->postJson('/api/mobile/google/exchange', ['code' => $code, 'device_name' => 'Pixel 8'])
            ->assertOk()
            ->assertJsonPath('user.email', 'g@x.com')
            ->assertJsonStructure(['token']);
        $user = User::where('email', 'g@x.com')->firstOrFail();
        $this->assertSame('Pixel 8', $user->tokens()->firstOrFail()->name);

        $this->postJson('/api/mobile/google/exchange', ['code' => $code, 'device_name' => 'Pixel 8'])
            ->assertUnprocessable()
            ->assertExactJson([
                'code' => 'code_invalid',
                'message' => MobileGoogleController::MESSAGE_CODE_INVALID,
            ]);
        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_code_expires_after_sixty_seconds(): void
    {
        $code = $this->issuedCode();

        $this->travel(61)->seconds();

        $this->postJson('/api/mobile/google/exchange', ['code' => $code, 'device_name' => 'Pixel 8'])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'code_invalid');
    }

    public function test_code_is_still_valid_just_inside_the_window(): void
    {
        $code = $this->issuedCode();

        $this->travel(59)->seconds();

        $this->postJson('/api/mobile/google/exchange', ['code' => $code, 'device_name' => 'Pixel 8'])->assertOk();
    }

    public function test_unknown_code_and_missing_fields_are_rejected(): void
    {
        $this->postJson('/api/mobile/google/exchange', ['code' => 'nope', 'device_name' => 'Pixel 8'])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'code_invalid')
            ->assertJsonPath('message', 'No se pudo completar el ingreso con Google. Intentá nuevamente.');

        $this->postJson('/api/mobile/google/exchange', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code', 'device_name']);
    }

    // TC-73: the provider fails -> back to the app with the error, nothing created.
    public function test_provider_failure_returns_to_the_app_with_google_failed(): void
    {
        $this->mockProvider()->shouldReceive('user')->once()->andThrow(new \RuntimeException('boom'));

        $this->callbackFromApp()->assertRedirect(self::RETURN_TO.'?error=google_failed');

        $this->assertSame(0, User::count());
    }

    public function test_denied_permissions_return_to_the_app_as_cancelled(): void
    {
        $this->mockProvider()->shouldReceive('user')->never();

        $this->callbackFromApp('tdautos://auth/google?source=login', ['error' => 'access_denied'])
            ->assertRedirect('tdautos://auth/google?source=login&error=google_cancelled');
    }

    public function test_unverified_email_collision_returns_email_in_use(): void
    {
        User::factory()->create(['email' => 'g@x.com', 'auth_subject' => null]);
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser(verified: false));

        $this->callbackFromApp()->assertRedirect(self::RETURN_TO.'?error=email_in_use');
    }

    public function test_a_non_buyer_account_returns_not_buyer_without_a_code(): void
    {
        User::factory()->admin()->create(['email' => 'g@x.com', 'auth_subject' => 'google:S1']);
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser());

        $this->callbackFromApp()->assertRedirect(self::RETURN_TO.'?error=not_buyer');
    }

    public function test_redirect_without_return_to_or_with_a_foreign_one_is_rejected(): void
    {
        Socialite::shouldReceive('driver')->never();

        foreach ([null, 'https://evil.example/cb', 'tdautos:/x', 'tdautos://', "tdautos://a\r\nb", 'tdautos://a#frag'] as $returnTo) {
            $this->get(route('auth.google.redirect', array_filter(['client' => 'mobile', 'return_to' => $returnTo])))
                ->assertStatus(400)
                ->assertJsonPath('message', MobileGoogleController::MESSAGE_RETURN_TO_INVALID);
        }
    }

    public function test_expo_go_return_to_is_allowed_outside_production(): void
    {
        $provider = $this->mockProvider();
        $provider->shouldReceive('with')->andReturnSelf();
        $provider->shouldReceive('redirect')->once()->andReturn(redirect()->away('https://accounts.google.com'));

        $this->get(route('auth.google.redirect', ['client' => 'mobile', 'return_to' => 'exp://192.168.0.10:8081/--/auth']))
            ->assertRedirect('https://accounts.google.com');
    }

    public function test_expo_go_return_to_is_rejected_in_production(): void
    {
        $this->app['env'] = 'production';
        Socialite::shouldReceive('driver')->never();

        $this->get(route('auth.google.redirect', ['client' => 'mobile', 'return_to' => 'exp://192.168.0.10:8081/--/auth']))
            ->assertStatus(400);
    }

    public function test_configured_prefixes_replace_the_default(): void
    {
        config(['mobile.redirect_prefixes' => ['com.tdautos.app://']]);
        Socialite::shouldReceive('driver')->never();

        $this->get(route('auth.google.redirect', ['client' => 'mobile', 'return_to' => self::RETURN_TO]))
            ->assertStatus(400);
    }

    public function test_web_flow_is_unchanged_without_the_mobile_client(): void
    {
        $this->mockProvider()->shouldReceive('user')->once()->andReturn($this->googleUser());

        $this->get(route('auth.google.callback'))->assertRedirect(rtrim((string) config('app.frontend_url'), '/').'/');

        $this->assertAuthenticated();
    }
}
