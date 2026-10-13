<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets only approved dealers through (RF16). Meant to sit behind an auth
 * middleware on the inventory management routes.
 */
class EnsureDealerIsActive
{
    public const MESSAGE_PENDING = 'Tu cuenta está pendiente de aprobación. Todavía no podés gestionar el inventario.';

    public const MESSAGE_FORBIDDEN = 'No tenés permiso para realizar esta acción.';

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $dealer = $user?->esConcesionaria() ? $user->concesionaria : null;

        if (! $dealer) {
            return response()->json(['message' => self::MESSAGE_FORBIDDEN], 403);
        }

        // Subscription validity (RF21) will be added to this gate by the subscription stories.
        if (! $dealer->estaActiva()) {
            return response()->json(['message' => self::MESSAGE_PENDING], 403);
        }

        return $next($request);
    }
}
