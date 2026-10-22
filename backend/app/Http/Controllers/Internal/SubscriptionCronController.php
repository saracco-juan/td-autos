<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Services\Subscription\SubscriptionLifecycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Runs the same work as `suscripciones:procesar` for an external scheduler (the free host
 * has no cron). Disabled (404) until CRON_SECRET is set; any other token gets 401.
 */
class SubscriptionCronController extends Controller
{
    public function __invoke(Request $request, SubscriptionLifecycle $lifecycle): JsonResponse
    {
        $secret = (string) config('cron.secret');

        abort_if($secret === '', 404);

        if (! hash_equals($secret, (string) $request->bearerToken())) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return response()->json([
            'inactivated_subscriptions' => $lifecycle->process(),
            'deleted_vehicles' => $lifecycle->purgeExpiredVehicles(),
        ]);
    }
}
