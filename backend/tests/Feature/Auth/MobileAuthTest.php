<?php

namespace Tests\Feature\Auth;

use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Mobile\MobileAuthController;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class MobileAuthTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function registration(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Ana',
            'email' => 'ana@example.com',
            'password' => 'ClaveSegura1',
            'password_confirmation' => 'ClaveSegura1',
            'device_name' => 'Pixel 8',
        ], $overrides);
    }

    // TC-01: a buyer registers from the app and receives a token.
    public function test_buyer_registers_and_receives_a_token(): void
    {
        $response = $this->postJson('/api/mobile/register', $this->registration());

        $response->assertCreated()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'rol']])
            ->assertJsonPath('user.email', 'ana@example.com')
            ->assertJsonPath('user.rol', User::ROL_COMPRADOR);
        $user = User::where('email', 'ana@example.com')->firstOrFail();
        $this->assertSame('Pixel 8', $user->tokens()->firstOrFail()->name);
        $this->assertGuest('web');

        $this->app['auth']->forgetGuards();
        $this->withToken($response->json('token'))->getJson('/api/user')
            ->assertOk()->assertJsonPath('email', 'ana@example.com');
    }

    // TC-03: registration validation reuses the web messages.
    public function test_registration_reports_the_web_validation_messages(): void
    {
        $this->postJson('/api/mobile/register', [])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'El nombre es obligatorio.')
            ->assertJsonPath('errors.email.0', 'El email es obligatorio.')
            ->assertJsonPath('errors.password.0', 'La contraseña es obligatoria.')
            ->assertJsonValidationErrors('device_name');

        $this->postJson('/api/mobile/register', $this->registration(['password_confirmation' => 'otra']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.password.0', 'Las contraseñas no coinciden.');

        $this->assertSame(0, User::count());
    }

    // TC-04: duplicate email and weak password are rejected.
    public function test_registration_rejects_duplicate_email_and_weak_password(): void
    {
        User::factory()->create(['email' => 'ana@example.com']);

        $this->postJson('/api/mobile/register', $this->registration())
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'El email ya está en uso.');

        $this->postJson('/api/mobile/register', $this->registration([
            'email' => 'nueva@example.com',
            'password' => 'corta',
            'password_confirmation' => 'corta',
        ]))->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    // TC-05: successful login.
    public function test_buyer_logs_in_and_receives_a_token_without_a_web_session(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/mobile/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Pixel 8',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonStructure(['token']);
        $this->assertSame('Pixel 8', $user->tokens()->firstOrFail()->name);
        $this->assertGuest('web');
    }

    // TC-06: every kind of bad credentials gets the same message.
    public function test_bad_credentials_get_the_uniform_message(): void
    {
        $user = User::factory()->create();
        $cases = [
            'wrong password' => [$user->email, 'wrong-password'],
            'unknown email' => ['nobody@example.com', 'password'],
            'inactive' => [User::factory()->inactive()->create()->email, 'password'],
            'google only' => [User::factory()->googleOnly()->create()->email, 'password'],
        ];

        foreach ($cases as [$email, $password]) {
            $this->postJson('/api/mobile/login', ['email' => $email, 'password' => $password, 'device_name' => 'Pixel 8'])
                ->assertUnprocessable()
                ->assertJsonPath('errors.email.0', LoginRequest::MESSAGE_INVALID_CREDENTIALS);
        }

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_login_requires_its_fields(): void
    {
        $this->postJson('/api/mobile/login', [])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'El email es obligatorio.')
            ->assertJsonPath('errors.password.0', 'La contraseña es obligatoria.')
            ->assertJsonValidationErrors('device_name');
    }

    public function test_login_is_locked_out_after_too_many_attempts(): void
    {
        $user = User::factory()->create();
        $body = ['email' => $user->email, 'password' => 'wrong-password', 'device_name' => 'Pixel 8'];

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/mobile/login', $body)->assertUnprocessable();
        }

        $response = $this->postJson('/api/mobile/login', [...$body, 'password' => 'password']);

        $response->assertUnprocessable();
        $this->assertMatchesRegularExpression(
            '/^Demasiados intentos\. Probá de nuevo en \d+ segundos\.$/u',
            $response->json('errors.email.0'),
        );
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_dealers_and_admins_are_refused_with_not_buyer(): void
    {
        foreach ([User::factory()->dealer()->create(), User::factory()->admin()->create()] as $user) {
            $this->postJson('/api/mobile/login', [
                'email' => $user->email,
                'password' => 'password',
                'device_name' => 'Pixel 8',
            ])->assertForbidden()
                ->assertExactJson(['code' => 'not_buyer', 'message' => MobileAuthController::MESSAGE_NOT_BUYER]);

            $this->assertSame(0, $user->tokens()->count());
        }

        $this->assertSame(
            'La app es solo para compradores. Si tenés una concesionaria, ingresá desde la web.',
            MobileAuthController::MESSAGE_NOT_BUYER,
        );
    }

    public function test_a_bearer_token_on_a_guest_route_is_ignored(): void
    {
        $other = User::factory()->create();
        $user = User::factory()->create();
        $token = $other->createToken('Old phone')->plainTextToken;

        $this->withToken($token)->postJson('/api/mobile/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'Pixel 8',
        ])->assertOk()->assertJsonPath('user.id', $user->id);
    }

    // TC-83: logout deletes only the token used for the request.
    public function test_logout_deletes_only_the_current_token(): void
    {
        $user = User::factory()->create();
        $current = $user->createToken('Pixel 8')->plainTextToken;
        $user->createToken('Tablet');

        $this->withToken($current)->postJson('/api/mobile/logout')->assertNoContent();

        $this->assertSame(['Tablet'], $user->tokens()->pluck('name')->all());
    }

    // TC-84: the revoked token no longer opens protected endpoints.
    public function test_revoked_token_is_unauthorized(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('Pixel 8')->plainTextToken;

        $this->withToken($token)->postJson('/api/mobile/logout')->assertNoContent();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
    }

    public function test_logout_without_a_token_is_unauthorized(): void
    {
        $this->postJson('/api/mobile/logout')->assertUnauthorized();
    }

    // TC-07: the recovery email goes out and the answer never reveals the account.
    public function test_forgot_password_sends_the_link_with_the_uniform_status(): void
    {
        Notification::fake();
        $user = User::factory()->create();

        $this->postJson('/api/mobile/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertExactJson(['status' => PasswordResetLinkController::STATUS_MESSAGE]);
        $this->postJson('/api/mobile/forgot-password', ['email' => 'nobody@example.com'])
            ->assertOk()
            ->assertExactJson(['status' => PasswordResetLinkController::STATUS_MESSAGE]);

        Notification::assertSentTo($user, ResetPasswordNotification::class);
        Notification::assertCount(1);
    }

    public function test_forgot_password_validates_the_email(): void
    {
        $this->postJson('/api/mobile/forgot-password', ['email' => 'nope'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'El email no tiene un formato válido.');
    }

    public function test_resetting_the_password_revokes_every_api_token(): void
    {
        $user = User::factory()->create();
        $user->createToken('Pixel 8');
        $user->createToken('Tablet');
        $other = User::factory()->create();
        $other->createToken('Pixel 8');
        $token = Password::createToken($user);

        $this->postJson('/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'NuevaClave1',
            'password_confirmation' => 'NuevaClave1',
        ])->assertOk();

        $this->assertSame(0, $user->tokens()->count());
        $this->assertSame(1, $other->tokens()->count());
    }
}
