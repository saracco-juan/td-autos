<?php

namespace Tests\Feature\Auth;

use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PasswordResetLinkTest extends TestCase
{
    use RefreshDatabase;

    private const UNIFORM_STATUS = 'Si existe una cuenta asociada, recibirás instrucciones por email.';

    // TC-07: an existing account receives the recovery email.
    public function test_reset_password_link_can_be_requested(): void
    {
        Notification::fake();

        $user = User::factory()->create();

        $this->postJson('/forgot-password', ['email' => $user->email])->assertOk();

        Notification::assertSentTo($user, ResetPasswordNotification::class);
    }

    public function test_existing_account_gets_the_uniform_response(): void
    {
        Notification::fake();

        $user = User::factory()->create();

        $this->postJson('/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertExactJson(['status' => self::UNIFORM_STATUS]);

        $this->assertSame(self::UNIFORM_STATUS, PasswordResetLinkController::STATUS_MESSAGE);
    }

    public function test_unknown_email_gets_the_same_response_and_nothing_is_sent(): void
    {
        Notification::fake();

        $this->postJson('/forgot-password', ['email' => 'nobody@example.com'])
            ->assertOk()
            ->assertExactJson(['status' => self::UNIFORM_STATUS]);

        Notification::assertNothingSent();
    }

    public function test_throttled_request_gets_the_same_response(): void
    {
        Notification::fake();

        $user = User::factory()->create();

        $this->postJson('/forgot-password', ['email' => $user->email])->assertOk();

        $this->postJson('/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertExactJson(['status' => self::UNIFORM_STATUS]);

        Notification::assertSentToTimes($user, ResetPasswordNotification::class, 1);
    }

    public function test_email_is_normalized_before_lookup(): void
    {
        Notification::fake();

        $user = User::factory()->create(['email' => 'person@example.com']);

        $this->postJson('/forgot-password', ['email' => '  Person@Example.COM '])->assertOk();

        Notification::assertSentTo($user, ResetPasswordNotification::class);
    }

    public function test_missing_email_is_rejected_in_spanish(): void
    {
        $this->postJson('/forgot-password', [])
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(['email'])
            ->assertJsonPath('errors.email.0', 'El email es obligatorio.');
    }

    public function test_malformed_email_is_rejected_in_spanish(): void
    {
        $this->postJson('/forgot-password', ['email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertOnlyJsonValidationErrors(['email'])
            ->assertJsonPath('errors.email.0', 'El email no tiene un formato válido.');
    }

    public function test_link_points_to_the_frontend_reset_route_with_the_encoded_email(): void
    {
        Notification::fake();
        config(['app.frontend_url' => 'http://localhost:5173/']);

        $user = User::factory()->create(['email' => 'juan+tag@example.com']);

        $this->postJson('/forgot-password', ['email' => $user->email])->assertOk();

        Notification::assertSentTo($user, ResetPasswordNotification::class, function (ResetPasswordNotification $notification) use ($user) {
            $this->assertSame(
                'http://localhost:5173/restablecer/'.$notification->token.'?email=juan%2Btag%40example.com',
                $notification->toMail($user)->actionUrl,
            );

            return true;
        });
    }

    public function test_email_is_written_in_spanish(): void
    {
        $user = User::factory()->create(['name' => 'Juan']);
        $mail = (new ResetPasswordNotification('token-123'))->toMail($user);

        $this->assertSame('Restablecé tu contraseña de TD Autos', $mail->subject);
        $this->assertSame('Hola Juan', $mail->greeting);
        $this->assertSame('RESTABLECER CONTRASEÑA', $mail->actionText);
        $this->assertContains(
            'Este enlace de restablecimiento vence en 60 minutos.',
            $mail->outroLines,
        );
        $this->assertContains(
            'Si no pediste restablecer tu contraseña, ignorá este mensaje: tu cuenta sigue segura.',
            $mail->outroLines,
        );
        $this->assertSame([], array_filter(
            $mail->introLines,
            fn (string $line) => ! str_contains($line, 'contraseña'),
        ));
    }
}
