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

    private const SESSION_ORIGIN = 'google_auth_origin';

    private const ORIGIN_REGISTER = 'registro';

    private const ORIGIN_LOGIN = 'login';

    // Closed allowlist: the failure path is never built from raw input.
    private const ORIGINS = [self::ORIGIN_REGISTER, self::ORIGIN_LOGIN];

    public function redirect(Request $request): RedirectResponse
    {
        $from = $request->query('from');
        $request->session()->put(
            self::SESSION_ORIGIN,
            is_string($from) && in_array($from, self::ORIGINS, true) ? $from : self::ORIGIN_REGISTER,
        );

        return Socialite::driver('google')
            ->with(['prompt' => 'select_account'])
            ->redirect();
    }

    public function callback(Request $request, GoogleAccountResolver $resolver): RedirectResponse
    {
        $origin = $request->session()->pull(self::SESSION_ORIGIN);
        $origin = in_array($origin, self::ORIGINS, true) ? $origin : self::ORIGIN_REGISTER;

        if ($request->query->has('error')) {
            return $this->failure($origin, self::ERROR_CANCELLED);
        }

        try {
            $profile = GoogleProfile::fromSocialite(Socialite::driver('google')->user());
            $user = $resolver->resolve($profile);
        } catch (GoogleEmailConflictException) {
            return $this->failure($origin, self::ERROR_EMAIL_IN_USE);
        } catch (Throwable $e) {
            report($e);

            return $this->failure($origin, self::ERROR_FAILED);
        }

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->away($this->frontendUrl('/'));
    }

    private function failure(string $origin, string $code): RedirectResponse
    {
        return redirect()->away($this->frontendUrl('/'.$origin.'?error='.$code));
    }

    private function frontendUrl(string $path): string
    {
        return rtrim((string) config('app.frontend_url'), '/').$path;
    }
}
