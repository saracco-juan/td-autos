<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Services\Resale\DnrpaRefreshLauncher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Starts the daily `dnrpa:refresh` for an external scheduler (the free host runs no scheduler).
 * Disabled (404) until CRON_SECRET is set; any other token gets 401. Answers 202 at once: the
 * refresh keeps running in the background and records its own result.
 */
class DnrpaCronController extends Controller
{
    public function __invoke(Request $request, DnrpaRefreshLauncher $launcher): JsonResponse
    {
        $secret = (string) config('cron.secret');

        abort_if($secret === '', 404);

        if (! hash_equals($secret, (string) $request->bearerToken())) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return response()->json(['started' => $launcher->launch()], 202);
    }
}
