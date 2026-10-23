<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Services\Calculadora\CalculatorRatesStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Runs the same work as `calculadora:refresh` for an external scheduler (the free host has no cron, so
 * Laravel's own schedule never fires there). Disabled (404) until CRON_SECRET is set; any other token gets 401.
 */
class CalculatorCronController extends Controller
{
    public function __invoke(Request $request, CalculatorRatesStore $store): JsonResponse
    {
        $secret = (string) config('cron.secret');

        abort_if($secret === '', 404);

        if (! hash_equals($secret, (string) $request->bearerToken())) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // The CSV download can take a while on a cold free instance.
        set_time_limit(300);

        return response()->json($store->refresh());
    }
}
