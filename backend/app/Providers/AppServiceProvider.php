<?php

namespace App\Providers;

use App\Mail\Transport\GmailApiTransport;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void {}

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->usePublicAppUrl();

        Mail::extend('gmail', fn (array $config) => new GmailApiTransport(
            $this->app->make(HttpFactory::class),
            $this->app->make('cache.store'),
            (string) ($config['client_id'] ?? ''),
            (string) ($config['client_secret'] ?? ''),
            (string) ($config['refresh_token'] ?? ''),
        ));

        ResetPassword::createUrlUsing(function (object $notifiable, string $token) {
            $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
            $email = urlencode($notifiable->getEmailForPasswordReset());

            return "{$frontendUrl}/restablecer/{$token}?email={$email}";
        });

        // Signed over the path Laravel sees (the route uses `signed:relative`), so the link still
        // validates when the proxy strips the public prefix (e.g. /backend) before forwarding it.
        VerifyEmail::createUrlUsing(fn (object $notifiable) => $this->publicSignedUrl(
            'verification.verify',
            now()->addMinutes((int) config('auth.verification.expire', 60)),
            ['id' => $notifiable->getKey(), 'hash' => sha1($notifiable->getEmailForVerification())],
        ));
    }

    /**
     * A temporary signed URL whose signature covers only the route path, prefixed with APP_URL.
     * Relative URLs keep the forced root's path, so the root is reset while signing.
     *
     * @param  array<string, mixed>  $parameters
     */
    private function publicSignedUrl(string $route, \DateTimeInterface $expiration, array $parameters): string
    {
        $appUrl = rtrim((string) config('app.url'), '/');
        $generator = URL::getFacadeRoot();

        $generator->forceRootUrl(null);

        try {
            $path = $generator->temporarySignedRoute($route, $expiration, $parameters, absolute: false);
        } finally {
            $this->usePublicAppUrl();
        }

        return $appUrl.$path;
    }

    /**
     * Deployed, the API is reached through a proxy at a public https URL with a path prefix
     * (APP_URL, e.g. https://<app>.vercel.app/backend) that Laravel cannot see in the request.
     * An https APP_URL marks that case, in every deployed environment; local http stays untouched.
     */
    private function usePublicAppUrl(): void
    {
        $appUrl = rtrim((string) config('app.url'), '/');

        if (! Str::startsWith($appUrl, 'https://')) {
            return;
        }

        URL::forceScheme('https');
        URL::forceRootUrl($appUrl);
    }
}
