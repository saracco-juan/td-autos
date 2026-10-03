<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Middleware\RedirectIfAuthenticated as BaseRedirectIfAuthenticated;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guest-only middleware that answers JSON clients with a 409 conflict
 * instead of an HTML redirect when a session already exists.
 */
class RedirectIfAuthenticated extends BaseRedirectIfAuthenticated
{
    public function handle(Request $request, Closure $next, string ...$guards): Response
    {
        if ($request->expectsJson() && $this->isAuthenticated($guards)) {
            return response()->json(['message' => 'Ya existe una sesión iniciada.'], 409);
        }

        return parent::handle($request, $next, ...$guards);
    }

    /**
     * @param  array<int, string>  $guards
     */
    private function isAuthenticated(array $guards): bool
    {
        foreach ($guards ?: [null] as $guard) {
            if (Auth::guard($guard)->check()) {
                return true;
            }
        }

        return false;
    }
}
