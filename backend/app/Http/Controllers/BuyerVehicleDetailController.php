<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Vehiculo;
use App\Services\Subscription\SubscriptionLifecycle;
use App\Support\BuyerVehicleDetail;
use App\Support\VehiculoOptions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class BuyerVehicleDetailController extends Controller
{
    // HU09 / TC-77: availability is evaluated on every read, independently of a saved ranking.
    public function __invoke(Request $request, string $id, SubscriptionLifecycle $lifecycle): JsonResponse
    {
        abort_unless($request->user()->rol === User::ROL_COMPRADOR, 403);
        $dealerIds = $lifecycle->operativeDealerIds(now());
        $vehicle = Vehiculo::query()->whereKey($id)
            ->where('origen', VehiculoOptions::ORIGEN_CONCESIONARIA)
            ->whereHas('propiedad', fn ($query) => $query->where('visible', true)
                ->whereIn('concesionaria_id', $dealerIds))
            ->with(['propiedad.concesionaria:id,nombre,provincia', 'tipoCarroceria', 'fotos'])
            ->first();

        $data = $vehicle === null
            ? ['message' => 'Esta publicación ya no está disponible.']
            : BuyerVehicleDetail::present($vehicle);

        return response()->json($data, $vehicle === null ? 404 : 200)
            ->header('Cache-Control', 'private, no-store');
    }
}
