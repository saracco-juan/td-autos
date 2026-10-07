<?php

namespace Tests\Feature\Auth;

use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    // TC-05: successful login.
    public function test_users_can_authenticate_using_the_login_screen(): void
    {
        $user = User::factory()->create();

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertNoContent();
    }

    // TC-06: invalid password.
    public function test_users_can_not_authenticate_with_invalid_password(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('errors.email.0', LoginRequest::MESSAGE_INVALID_CREDENTIALS);
        $this->assertGuest();
    }

    // TC-06: an unknown email gets the same message, so the failing field is not revealed.
    public function test_users_can_not_authenticate_with_unknown_email(): void
    {
        $response = $this->postJson('/login', [
            'email' => 'nobody@example.com',
            'password' => 'password',
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('errors.email.0', LoginRequest::MESSAGE_INVALID_CREDENTIALS);
        $this->assertGuest();
    }

    public function test_inactive_users_can_not_authenticate_with_correct_credentials(): void
    {
        $user = User::factory()->inactive()->create();

        $response = $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('errors.email.0', LoginRequest::MESSAGE_INVALID_CREDENTIALS);
        $this->assertGuest();
    }

    public function test_google_only_accounts_can_not_authenticate_with_a_password(): void
    {
        $user = User::factory()->googleOnly()->create();

        $response = $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('errors.email.0', LoginRequest::MESSAGE_INVALID_CREDENTIALS);
        $this->assertGuest();
    }

    public function test_login_normalizes_the_email_before_authenticating(): void
    {
        User::factory()->create(['email' => 'test@example.com']);

        $response = $this->postJson('/login', [
            'email' => '  Test@Example.COM ',
            'password' => 'password',
        ]);

        $response->assertNoContent();
        $this->assertAuthenticated();
    }

    public function test_login_validation_messages_are_in_spanish(): void
    {
        $response = $this->postJson('/login', []);

        $response->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'El email es obligatorio.')
            ->assertJsonPath('errors.password.0', 'La contraseña es obligatoria.');

        $this->postJson('/login', ['email' => 'not-an-email', 'password' => 'password'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'El email no tiene un formato válido.');
    }

    public function test_login_is_locked_out_after_too_many_attempts_with_a_spanish_message(): void
    {
        $user = User::factory()->create();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/login', ['email' => $user->email, 'password' => 'wrong-password'])
                ->assertUnprocessable();
        }

        $response = $this->postJson('/login', ['email' => $user->email, 'password' => 'password']);

        $response->assertUnprocessable();
        $this->assertMatchesRegularExpression(
            '/^Demasiados intentos\. Probá de nuevo en \d+ segundos\.$/u',
            $response->json('errors.email.0'),
        );
        $this->assertGuest();
    }

    public function test_users_can_logout(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertNoContent();
    }
}
