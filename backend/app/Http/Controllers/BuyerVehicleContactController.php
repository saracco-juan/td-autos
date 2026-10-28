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

        return response()->json(['url' => $contact->create($request->user(), $id)], 201)
            ->header('Cache-Control', 'private, no-store');
    }
}
