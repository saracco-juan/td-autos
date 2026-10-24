<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Services\Calculadora\CalculatorReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Yearly review alert for an external scheduler (the free host has no cron). Returns the review of
 * `calculadora:review` plus a ready-to-paste GitHub issue (`title`, `markdown`). It is an alert, so it answers 200
 * whatever it finds. Disabled (404) until CRON_SECRET is set; any other token gets 401.
 */
class CalculatorReviewCronController extends Controller
{
    public function __invoke(Request $request, CalculatorReview $review): JsonResponse
    {
        $secret = (string) config('cron.secret');

        abort_if($secret === '', 404);

        if (! hash_equals($secret, (string) $request->bearerToken())) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Source checks run in parallel with a 5 s timeout each; the cap covers a cold free instance.
        set_time_limit(120);

        $result = $review->run();

        return response()->json($result + ['title' => $review->title(), 'markdown' => $review->markdown($result)]);
    }
}
