<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Rules\StrongPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'Abcdef12',
            'password_confirmation' => 'Abcdef12',
        ], $overrides);
    }

    public function test_new_users_can_register(): void
    {
        $response = $this->postJson('/register', $this->payload());

        $response->assertCreated();
        $this->assertAuthenticated();
    }

    public function test_registration_returns_user_json_without_secrets_and_persists_buyer_role(): void
    {
        $response = $this->postJson('/register', $this->payload());

        $response->assertCreated()
            ->assertJsonPath('email', 'test@example.com')
            ->assertJsonPath('rol', 'comprador')
            ->assertJsonMissingPath('password')
            ->assertJsonMissingPath('remember_token')
            ->assertJsonMissingPath('auth_subject');
        $this->assertDatabaseHas('users', ['email' => 'test@example.com', 'rol' => 'comprador']);

        // Drop the guard cached in this test process so /api/user resolves the user from the session
        // like a real follow-up request (the cached instance is flagged wasRecentlyCreated => 201).
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/user')->assertOk()->assertJsonPath('email', 'test@example.com');
    }

    public function test_duplicate_email_is_rejected(): void
    {
        User::factory()->create(['email' => 'a@x.com']);

        $this->postJson('/register', $this->payload(['email' => 'a@x.com']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'El email ya está en uso.');

        $this->assertSame(1, User::count());
    }

    public function test_email_is_normalized_before_uniqueness_and_storage(): void
    {
        User::factory()->create(['email' => 'a@x.com']);

        $this->postJson('/register', $this->payload(['email' => '  A@X.COM ']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->postJson('/register', $this->payload(['email' => '  New@X.com ']))->assertCreated();
        $this->assertDatabaseHas('users', ['email' => 'new@x.com']);
    }

    public function test_weak_password_lists_every_unmet_requirement(): void
    {
        $this->postJson('/register', $this->payload(['password' => 'abc', 'password_confirmation' => 'abc']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.password', [
                StrongPassword::MESSAGE_MIN_LENGTH,
                StrongPassword::MESSAGE_UPPERCASE,
                StrongPassword::MESSAGE_NUMBER,
            ]);

        $this->assertSame(0, User::count());
    }

    public function test_password_confirmation_mismatch_is_rejected(): void
    {
        $this->postJson('/register', $this->payload(['password_confirmation' => 'Different12']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.password.0', 'Las contraseñas no coinciden.');

        $this->assertSame(0, User::count());
    }

    public function test_required_and_malformed_fields_report_errors_on_exactly_those_fields(): void
    {
        $this->postJson('/register', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password'])
            ->assertJsonMissingValidationErrors(['apellido']);

        $this->postJson('/register', $this->payload(['email' => 'not-an-email']))
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(['email']);
    }

    public function test_privileged_fields_in_payload_are_ignored(): void
    {
        $this->postJson('/register', $this->payload(['rol' => 'admin', 'auth_subject' => 'google:x']))
            ->assertCreated();

        $user = User::where('email', 'test@example.com')->firstOrFail();
        $this->assertSame('comprador', $user->rol);
        $this->assertNull($user->auth_subject);
    }

    public function test_apellido_is_optional_and_stored_when_supplied(): void
    {
        $this->postJson('/register', $this->payload())->assertCreated();
        $this->assertNull(User::where('email', 'test@example.com')->firstOrFail()->apellido);

        $this->postJson('/logout');
        $this->postJson('/register', $this->payload(['email' => 'b@x.com', 'apellido' => 'Pérez']))->assertCreated();
        $this->assertSame('Pérez', User::where('email', 'b@x.com')->firstOrFail()->apellido);
    }
}
