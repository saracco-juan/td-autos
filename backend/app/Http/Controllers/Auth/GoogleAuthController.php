<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\Auth\GoogleEmailConflictException;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Mobile\MobileGoogleController;
use App\Models\User;
use App\Services\Auth\GoogleAccountResolver;
use App\Services\Auth\GoogleProfile;
use App\Services\Auth\MobileGoogleCode;
use App\Support\MobileReturnUrl;
use Illuminate\Http\JsonResponse;
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

    private const ERROR_NOT_BUYER = 'not_buyer';

    private const SESSION_ORIGIN = 'google_auth_origin';

    private const SESSION_CLIENT = 'google_auth_client';

    private const SESSION_RETURN_TO = 'google_auth_return_to';

    private const CLIENT_MOBILE = 'mobile';

    private const ORIGIN_REGISTER = 'registro';

    private const ORIGIN_LOGIN = 'login';

    // Closed allowlist: the failure path is never built from raw input.
    private const ORIGINS = [self::ORIGIN_REGISTER, self::ORIGIN_LOGIN];

    public function redirect(Request $request): RedirectResponse|JsonResponse
    {
        $mobile = $request->query('client') === self::CLIENT_MOBILE;

        if ($mobile && ! MobileReturnUrl::isAllowed($request->query('return_to'))) {
            return response()->json(['message' => MobileGoogleController::MESSAGE_RETURN_TO_INVALID], 400);
        }

        $request->session()->forget([self::SESSION_CLIENT, self::SESSION_RETURN_TO]);

        if ($mobile) {
            $request->session()->put([
                self::SESSION_CLIENT => self::CLIENT_MOBILE,
                self::SESSION_RETURN_TO => $request->query('return_to'),
            ]);
        }

        $from = $request->query('from');
        $request->session()->put(
            self::SESSION_ORIGIN,
            is_string($from) && in_array($from, self::ORIGINS, true) ? $from : self::ORIGIN_REGISTER,
        );

        return Socialite::driver('google')
            ->with(['prompt' => 'select_account'])
            ->redirect();
    }

    public function callback(Request $request, GoogleAccountResolver $resolver, MobileGoogleCode $codes): RedirectResponse
    {
        $origin = $request->session()->pull(self::SESSION_ORIGIN);
        $origin = in_array($origin, self::ORIGINS, true) ? $origin : self::ORIGIN_REGISTER;

        $client = $request->session()->pull(self::SESSION_CLIENT);
        $returnTo = $request->session()->pull(self::SESSION_RETURN_TO);
        $appReturnTo = $client === self::CLIENT_MOBILE && MobileReturnUrl::isAllowed($returnTo) ? $returnTo : null;

        if ($request->query->has('error')) {
            return $this->failure($origin, self::ERROR_CANCELLED, $appReturnTo);
        }

        try {
            $profile = GoogleProfile::fromSocialite(Socialite::driver('google')->user());
            $user = $resolver->resolve($profile);
        } catch (GoogleEmailConflictException) {
            return $this->failure($origin, self::ERROR_EMAIL_IN_USE, $appReturnTo);
        } catch (Throwable $e) {
            report($e);

            return $this->failure($origin, self::ERROR_FAILED, $appReturnTo);
        }

        if ($appReturnTo !== null) {
            // The app gets a one-time code to exchange for a token: no web session, no token in the URL.
            return $user->rol === User::ROL_COMPRADOR
                ? redirect()->away(MobileReturnUrl::with($appReturnTo, ['code' => $codes->issue($user)]))
                : $this->failure($origin, self::ERROR_NOT_BUYER, $appReturnTo);
        }

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->away($this->frontendUrl('/'));
    }

    private function failure(string $origin, string $code, ?string $appReturnTo = null): RedirectResponse
    {
        if ($appReturnTo !== null) {
            return redirect()->away(MobileReturnUrl::with($appReturnTo, ['error' => $code]));
        }

        return redirect()->away($this->frontendUrl('/'.$origin.'?error='.$code));
    }

    private function frontendUrl(string $path): string
    {
        return rtrim((string) config('app.frontend_url'), '/').$path;
    }
}
