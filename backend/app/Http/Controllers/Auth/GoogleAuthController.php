<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\Auth\GoogleEmailConflictException;
use App\Http\Controllers\Controller;
use App\Services\Auth\GoogleAccountResolver;
use App\Services\Auth\GoogleProfile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

class GoogleAuthController extends Controller
{
    private const ERROR_CANCELLED = 'google_cancelled';

    private const ERROR_FAILED = 'google_failed';

    private const ERROR_EMAIL_IN_USE = 'email_in_use';

    public function redirect(): RedirectResponse
    {
        return Socialite::driver('google')
            ->with(['prompt' => 'select_account'])
            ->redirect();
    }

    public function callback(Request $request, GoogleAccountResolver $resolver): RedirectResponse
    {
        if ($request->query->has('error')) {
            return $this->failure(self::ERROR_CANCELLED);
        }

        try {
            $profile = GoogleProfile::fromSocialite(Socialite::driver('google')->user());
            $user = $resolver->resolve($profile);
        } catch (GoogleEmailConflictException) {
            return $this->failure(self::ERROR_EMAIL_IN_USE);
        } catch (Throwable $e) {
            report($e);

            return $this->failure(self::ERROR_FAILED);
        }

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->away($this->frontendUrl('/'));
    }

    private function failure(string $code): RedirectResponse
    {
        return redirect()->away($this->frontendUrl('/registro?error='.$code));
    }

    private function frontendUrl(string $path): string
    {
        return rtrim((string) config('app.frontend_url'), '/').$path;
    }
}
