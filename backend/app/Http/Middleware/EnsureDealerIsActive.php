<?php

namespace App\Http\Middleware;

use App\Models\Concesionaria;
use App\Services\Subscription\SubscriptionLifecycle;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets only approved dealers with a valid subscription through (RF16, RF21). Meant to sit behind
 * an auth middleware on the inventory management routes.
 */
class EnsureDealerIsActive
{
    public function __construct(private readonly SubscriptionLifecycle $lifecycle) {}

    public const MESSAGE_PENDING = 'Tu cuenta está pendiente de aprobación. Todavía no podés gestionar el inventario.';

    public const MESSAGE_INACTIVE_SUBSCRIPTION = 'Tu suscripción está inactiva. Subí el comprobante de renovación para volver a gestionar tu inventario.';

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

        if (! $dealer->estaActiva()) {
            // Fail closed on any other state; only a pending request gets the pending copy.
            $message = $dealer->estado_alta === Concesionaria::ESTADO_PENDIENTE
                ? self::MESSAGE_PENDING
                : self::MESSAGE_FORBIDDEN;

            return response()->json(['message' => $message], 403);
        }

        // Evaluated on read, so the block and the hiding are immediate even before the scheduled command runs.
        // A dealer with no approved validity (no subscription yet, or only a pending one) is not blocked.
        $subscription = $dealer->suscripcion()->first();

        if ($subscription && $this->lifecycle->sync($subscription) === SubscriptionLifecycle::STATE_INACTIVE) {
            return response()->json(['message' => self::MESSAGE_INACTIVE_SUBSCRIPTION], 403);
        }

        return $next($request);
    }
}
