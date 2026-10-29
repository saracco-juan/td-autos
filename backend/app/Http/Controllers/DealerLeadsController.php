<?php

namespace App\Http\Controllers;

use App\Services\DealerLeads;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class DealerLeadsController extends Controller
{
    public function __invoke(Request $request, DealerLeads $leads): JsonResponse
    {
        $input = $request->validate(['period' => ['sometimes', 'required', 'string', Rule::in(['week', 'month', 'all'])]]);

        return response()->json($leads->summary($request->user(), $input['period'] ?? 'month'))
            ->header('Cache-Control', 'no-store, private');
    }
}
