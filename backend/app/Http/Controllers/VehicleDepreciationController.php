<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Resale\VehicleDepreciation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class VehicleDepreciationController extends Controller
{
    public function __invoke(Request $request, string $id, VehicleDepreciation $service): JsonResponse
    {
        abort_unless($request->user()->rol === User::ROL_COMPRADOR, 403);
        $data = $service->forVehicle((int) $id);

        return response()->json($data ?? ['message' => 'Esta publicación ya no está disponible.'], $data === null ? 404 : 200)
            ->header('Cache-Control', 'private, no-store');
    }
}
