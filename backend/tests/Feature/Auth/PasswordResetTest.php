<?php

namespace Tests\Feature\Auth;

use App\Http\Controllers\Auth\NewPasswordController;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use App\Rules\StrongPassword;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private const NEW_PASSWORD = 'NuevaClave1';

    private const SUCCESS_STATUS = 'Tu contraseña fue actualizada. Ingresá con tu nueva contraseña.';

    private const EXPIRED_MESSAGE = 'El enlace para restablecer tu contraseña expiró. Solicitá uno nuevo.';

    private const INVALID_MESSAGE = 'El enlace para restablecer tu contraseña no es válido. Solicitá uno nuevo.';

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(User $user, string $token, array $overrides = []): array
    {
        return array_merge([
            'token' => $token,
            'email' => $user->email,
            'password' => self::NEW_PASSWORD,
            'password_confirmation' => self::NEW_PASSWORD,
        ], $overrides);
    }

    public function test_password_can_be_reset_with_valid_token(): void
    {
        Notification::fake();

        $user = User::factory()->create();
        $oldHash = $user->password;
        $oldRememberToken = $user->remember_token;

        $this->postJson('/forgot-password', ['email' => $user->email])->assertOk();

        Notification::assertSentTo($user, ResetPasswordNotification::class, function (object $notification) use ($user) {
            $this->postJson('/reset-password', $this->payload($user, $notification->token))
                ->assertOk()
                ->assertExactJson(['status' => self::SUCCESS_STATUS]);

            return true;
        });

        $user->refresh();
        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $user->password));
        $this->assertNotSame($oldHash, $user->password);
        $this->assertNotSame($oldRememberToken, $user->remember_token);
        $this->assertSame(self::SUCCESS_STATUS, NewPasswordController::STATUS_MESSAGE);
    }

    public function test_successful_reset_dispatches_the_password_reset_event(): void
    {
        Event::fake([PasswordReset::class]);

        $user = User::factory()->create();
        $token = Password::broker()->createToken($user);

        $this->postJson('/reset-password', $this->payload($user, $token))->assertOk();

        Event::assertDispatched(PasswordReset::class);
    }

    public function test_email_is_normalized_before_lookup(): void
    {
        $user = User::factory()->create(['email' => 'person@example.com']);
        $token = Password::broker()->createToken($user);

        $this->postJson('/reset-password', $this->payload($user, $token, ['email' => '  Person@Example.COM ']))
            ->assertOk();

        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $user->refresh()->password));
    }

    // TC-08: an expired recovery link is rejected and the password does not change.
    public function test_expired_token_is_rejected_and_password_is_unchanged(): void
    {
        $user = User::factory()->create();
        $oldHash = $user->password;
        $token = Password::broker()->createToken($user);

        $this->travel(61)->minutes();

        $this->postJson('/reset-password', $this->payload($user, $token))
            ->assertUnprocessable()
            ->assertJsonPath('code', 'token_expired')
            ->assertJsonPath('message', self::EXPIRED_MESSAGE)
            ->assertJsonPath('errors.token.0', self::EXPIRED_MESSAGE);

        $this->assertSame($oldHash, $user->refresh()->password);
        $this->assertSame('token_expired', NewPasswordController::CODE_TOKEN_EXPIRED);
        $this->assertSame(self::EXPIRED_MESSAGE, NewPasswordController::MESSAGE_TOKEN_EXPIRED);
    }

    public function test_token_just_inside_the_validity_window_still_works(): void
    {
        $user = User::factory()->create();
        $token = Password::broker()->createToken($user);

        $this->travel(59)->minutes();

        $this->postJson('/reset-password', $this->payload($user, $token))->assertOk();

        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $user->refresh()->password));
    }

    public function test_wrong_token_is_rejected_as_invalid(): void
    {
        $user = User::factory()->create();
        $oldHash = $user->password;
        Password::broker()->createToken($user);

        $this->postJson('/reset-password', $this->payload($user, 'not-the-token'))
            ->assertUnprocessable()
            ->assertJsonPath('code', 'token_invalid')
            ->assertJsonPath('message', self::INVALID_MESSAGE)
            ->assertJsonPath('errors.token.0', self::INVALID_MESSAGE);

        $this->assertSame($oldHash, $user->refresh()->password);
        $this->assertSame('token_invalid', NewPasswordController::CODE_TOKEN_INVALID);
        $this->assertSame(self::INVALID_MESSAGE, NewPasswordController::MESSAGE_TOKEN_INVALID);
    }

    public function test_wrong_token_after_expiry_is_invalid_not_expired(): void
    {
        $user = User::factory()->create();
        Password::broker()->createToken($user);

        $this->travel(61)->minutes();

        $this->postJson('/reset-password', $this->payload($user, 'not-the-token'))
            ->assertUnprocessable()
            ->assertJsonPath('code', 'token_invalid');
    }

    public function test_user_without_a_token_row_is_rejected_as_invalid(): void
    {
        $user = User::factory()->create();

        $this->postJson('/reset-password', $this->payload($user, 'any-token'))
            ->assertUnprocessable()
            ->assertJsonPath('code', 'token_invalid');
    }

    public function test_unknown_email_gets_the_same_response_as_a_wrong_token(): void
    {
        $user = User::factory()->create();
        Password::broker()->createToken($user);

        $wrongToken = $this->postJson('/reset-password', $this->payload($user, 'not-the-token'));
        $unknownEmail = $this->postJson('/reset-password', $this->payload($user, 'not-the-token', [
            'email' => 'nobody@example.com',
        ]));

        $unknownEmail->assertUnprocessable()->assertExactJson($wrongToken->json());
    }

    public function test_token_cannot_be_reused_after_a_successful_reset(): void
    {
        $user = User::factory()->create();
        $token = Password::broker()->createToken($user);

        $this->postJson('/reset-password', $this->payload($user, $token))->assertOk();

        $this->postJson('/reset-password', $this->payload($user, $token, [
            'password' => 'OtraClave2',
            'password_confirmation' => 'OtraClave2',
        ]))
            ->assertUnprocessable()
            ->assertJsonPath('code', 'token_invalid');

        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $user->refresh()->password));
    }

    public function test_weak_password_is_rejected_with_the_registration_messages(): void
    {
        $user = User::factory()->create();
        $oldHash = $user->password;
        $token = Password::broker()->createToken($user);

        $response = $this->postJson('/reset-password', $this->payload($user, $token, [
            'password' => 'abc',
            'password_confirmation' => 'abc',
        ]))
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(['password'])
            ->assertJsonMissingPath('code');

        $this->assertEqualsCanonicalizing(
            [
                StrongPassword::MESSAGE_MIN_LENGTH,
                StrongPassword::MESSAGE_UPPERCASE,
                StrongPassword::MESSAGE_NUMBER,
            ],
            $response->json('errors.password'),
        );
        $this->assertSame($oldHash, $user->refresh()->password);
    }

    public function test_password_confirmation_mismatch_is_rejected_in_spanish(): void
    {
        $user = User::factory()->create();
        $oldHash = $user->password;
        $token = Password::broker()->createToken($user);

        $this->postJson('/reset-password', $this->payload($user, $token, [
            'password_confirmation' => 'Distinta1',
        ]))
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(['password'])
            ->assertJsonPath('errors.password.0', 'Las contraseñas no coinciden.');

        $this->assertSame($oldHash, $user->refresh()->password);
    }

    public function test_missing_fields_are_rejected_without_a_code(): void
    {
        $this->postJson('/reset-password', [])
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(['token', 'email', 'password'])
            ->assertJsonPath('errors.password.0', 'La contraseña es obligatoria.')
            ->assertJsonMissingPath('code');
    }
}
