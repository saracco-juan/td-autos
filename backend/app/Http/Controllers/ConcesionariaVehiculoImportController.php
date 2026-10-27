<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportVehiculosRequest;
use App\Services\Inventario\ImportConflictException;
use App\Services\Inventario\ImportPlan;
use App\Services\Inventario\VehiculoImportApplier;
use App\Services\Inventario\VehiculoImportPlanner;
use App\Support\VehiculoFields;
use Illuminate\Http\JsonResponse;

/**
 * Bulk load of the signed-in dealer's inventory by XLSX (CU-20). The route group already
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
            return $this->rejected($plan->errores());
        }

        return response()->json($this->counts($plan));
    }

    /**
     * Validate the file again and apply it whole: every row or none. Photo files replaced by the
     * new URLs are deleted from the disk only once the transaction has committed.
     */
    public function import(ImportVehiculosRequest $request, VehiculoImportPlanner $planner, VehiculoImportApplier $applier): JsonResponse
    {
        $dealer = $request->user()->concesionaria;
        $plan = $planner->plan($dealer, $request->file('archivo')->get());

        if ($plan->hasErrors()) {
            return $this->rejected($plan->errores());
        }

        try {
            $applier->apply($dealer, $plan);
        } catch (ImportConflictException $e) {
            return $this->rejected([[
                'fila' => $e->row->fila,
                'patente' => $e->row->patente,
                'mensajes' => [VehiculoFields::PATENTE_TAKEN_MESSAGE],
            ]]);
        }

        return response()->json($this->counts($plan));
    }

    /**
     * @return array{nuevos: int, actualizaciones: int}
     */
    private function counts(ImportPlan $plan): array
    {
        return ['nuevos' => count($plan->nuevos()), 'actualizaciones' => count($plan->actualizaciones())];
    }

    /**
     * @param  list<array{fila: int, patente: ?string, mensajes: list<string>}>  $errores
     */
    private function rejected(array $errores): JsonResponse
    {
        return response()->json(['message' => self::MESSAGE_WITH_ERRORS, 'errores' => $errores], 422);
    }
}
