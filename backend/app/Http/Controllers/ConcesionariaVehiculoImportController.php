<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportVehiculosRequest;
use App\Services\Inventario\VehiculoImportPlanner;
use Illuminate\Http\JsonResponse;

/**
 * Bulk load of the signed-in dealer's inventory by CSV (CU-20). The route group already
 * guarantees an active dealer.
 */
class ConcesionariaVehiculoImportController extends Controller
{
    public const MESSAGE_WITH_ERRORS = 'El archivo tiene errores. No se aplicó ningún cambio.';

    /**
     * Dry run: validate the whole file and count what would be created and updated.
     */
    public function preview(ImportVehiculosRequest $request, VehiculoImportPlanner $planner): JsonResponse
    {
        $plan = $planner->plan($request->user()->concesionaria, $request->file('archivo')->get());

        if ($plan->hasErrors()) {
            return response()->json(['message' => self::MESSAGE_WITH_ERRORS, 'errores' => $plan->errores()], 422);
        }

        return response()->json([
            'nuevos' => count($plan->nuevos()),
            'actualizaciones' => count($plan->actualizaciones()),
        ]);
    }
}
