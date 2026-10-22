<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Providers\AppServiceProvider;
use Illuminate\Auth\Events\Verified;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_email_can_be_verified(): void
    {
        $user = User::factory()->unverified()->create();

        Event::fake();

        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1($user->email)],
            absolute: false,
        );

        $response = $this->actingAs($user)->get($verificationUrl);

        Event::assertDispatched(Verified::class);
        $this->assertTrue($user->fresh()->hasVerifiedEmail());
        $response->assertRedirect(config('app.frontend_url').'/dashboard?verified=1');
    }

    public function test_email_is_not_verified_with_invalid_hash(): void
    {
        $user = User::factory()->unverified()->create();

        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1('wrong-email')],
            absolute: false,
        );

        $this->actingAs($user)->get($verificationUrl);

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_emailed_link_carries_the_public_prefix_and_validates_once_the_proxy_strips_it(): void
    {
        config(['app.url' => 'https://app.vercel.app/backend']);
        $this->app->getProvider(AppServiceProvider::class)->boot();
        $user = User::factory()->unverified()->create();

        $link = (new VerifyEmail)->toMail($user)->actionUrl;

        $this->assertStringStartsWith('https://app.vercel.app/backend/verify-email/', $link);

        // The proxy forwards the request without the /backend prefix. The test client builds
        // request URLs with the forced root, so drop it to send the path the API really receives.
        $forwarded = substr($link, strlen('https://app.vercel.app/backend'));
        URL::forceRootUrl(null);
        $this->actingAs($user)->get($forwarded)->assertRedirect();

        $this->assertTrue($user->fresh()->hasVerifiedEmail());
    }

    public function test_tampered_link_is_rejected(): void
    {
        $user = User::factory()->unverified()->create();
        $link = (new VerifyEmail)->toMail($user)->actionUrl;

        $this->actingAs($user)->get(str_replace('signature=', 'signature=x', $link))->assertForbidden();

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }
}
