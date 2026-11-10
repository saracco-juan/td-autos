<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\BuyerVehicleContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class BuyerVehicleContactController extends Controller
{
    public function __invoke(Request $request, int $id, BuyerVehicleContact $contact): JsonResponse
    {
        abort_unless($request->user()->rol === User::ROL_COMPRADOR, 403);
        $input = $request->validate(['attempt_id' => ['sometimes', 'required', 'uuid']]);

        return response()->json(['url' => $contact->create($request->user(), $id, $input['attempt_id'] ?? null)], 201)
            ->header('Cache-Control', 'private, no-store');
    }
}
