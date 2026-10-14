<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets only dealer accounts through, whatever their approval state (a pending dealer
 * must reach the subscription routes). Meant to sit behind an auth middleware.
 */
class EnsureUserIsDealer
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user?->esConcesionaria() || ! $user->concesionaria) {
            return response()->json(['message' => EnsureDealerIsActive::MESSAGE_FORBIDDEN], 403);
        }

        return $next($request);
    }
}
