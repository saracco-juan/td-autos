<?php

namespace App\Http\Controllers;

use App\Http\Requests\VehiculoCostosRequest;
use App\Services\Calculadora\VehicleCostEstimate;
use Illuminate\Http\JsonResponse;

final class VehiculoCostosController extends Controller
{
    public function show(VehiculoCostosRequest $request, string $id, VehicleCostEstimate $estimate): JsonResponse
    {
        $km = $request->validated('km');
        $estimated = $estimate->forUser(
            (int) $request->user()->id,
            ctype_digit($id) ? (int) $id : 0,
            $km === null ? null : (int) $km,
            $request->validated('cobertura') ?? 'terceros_completo',
        );

        return match ($estimated) {
            VehicleCostEstimate::NOT_FOUND => response()->json(['message' => 'No encontramos ese vehículo.'], 404),
            VehicleCostEstimate::RATE_UNAVAILABLE => response()->json(
                ['message' => 'No pudimos obtener la cotización del dólar. Probá de nuevo en unos minutos.'], 503),
            default => response()->json($estimated)->header('Cache-Control', 'private, no-store'),
        };
    }
}
