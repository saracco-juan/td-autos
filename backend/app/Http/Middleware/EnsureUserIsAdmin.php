<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets only administrator accounts through (RF19). Meant to sit behind an auth
 * middleware, which answers 401 to guests.
 */
class EnsureUserIsAdmin
{
    public const MESSAGE_FORBIDDEN = EnsureDealerIsActive::MESSAGE_FORBIDDEN;

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->esAdministrador()) {
            return response()->json(['message' => self::MESSAGE_FORBIDDEN], 403);
        }

        return $next($request);
    }
}
