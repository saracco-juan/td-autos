<?php

namespace App\Http\Controllers;

use App\Http\Requests\ToggleInspeccionItemRequest;
use App\Models\ChecklistInspeccion;
use App\Models\Vehiculo;
use App\Support\InspeccionChecklist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InspeccionController extends Controller
{
    /**
     * The vehicle, the item catalog and the authenticated user's marks (without creating a checklist).
     */
    public function show(Request $request, Vehiculo $vehiculo): JsonResponse
    {
        $checklist = $this->checklistOf($request, $vehiculo);

        return response()->json([
            'vehiculo' => $vehiculo->only(['id', 'marca', 'modelo', 'version', 'anio']),
            'pasos' => InspeccionChecklist::steps(),
        ] + $this->progress($checklist));
    }

    /**
     * Tick or untick one item. Any change puts the checklist back in progress.
     */
    public function toggle(ToggleInspeccionItemRequest $request, Vehiculo $vehiculo, string $codigo): JsonResponse
    {
        $completado = $request->boolean('completado');

        $checklist = DB::transaction(function () use ($request, $vehiculo, $codigo, $completado) {
            $checklist = $completado
                ? ChecklistInspeccion::createOrFirst(
                    ['usuario_id' => $request->user()->id, 'vehiculo_id' => $vehiculo->id],
                    ['estado' => ChecklistInspeccion::EN_CURSO, 'actualizado_en' => now()],
                )
                : $this->checklistOf($request, $vehiculo);

            if ($checklist === null) {
                return null;
            }

            if ($completado) {
                $checklist->items()->createOrFirst(['item_codigo' => $codigo], ['completado_en' => now()]);
            } else {
                $checklist->items()->where('item_codigo', $codigo)->delete();
            }

            $checklist->update(['estado' => ChecklistInspeccion::EN_CURSO, 'actualizado_en' => now()]);

            return $checklist;
        });

        return response()->json($this->progress($checklist));
    }

    /**
     * Close the checklist as complete (all items ticked) or incomplete.
     */
    public function finish(Request $request, Vehiculo $vehiculo): JsonResponse
    {
        $checklist = DB::transaction(function () use ($request, $vehiculo) {
            $checklist = ChecklistInspeccion::createOrFirst(
                ['usuario_id' => $request->user()->id, 'vehiculo_id' => $vehiculo->id],
                ['estado' => ChecklistInspeccion::INCOMPLETA, 'actualizado_en' => now()],
            );

            $complete = count($this->completedCodes($checklist)) === count(InspeccionChecklist::codes());
            $checklist->update([
                'estado' => $complete ? ChecklistInspeccion::COMPLETA : ChecklistInspeccion::INCOMPLETA,
                'actualizado_en' => now(),
            ]);

            return $checklist;
        });

        return response()->json($this->progress($checklist));
    }

    private function checklistOf(Request $request, Vehiculo $vehiculo): ?ChecklistInspeccion
    {
        return ChecklistInspeccion::where('usuario_id', $request->user()->id)
            ->where('vehiculo_id', $vehiculo->id)
            ->first();
    }

    /**
     * @return array{estado: string|null, items_completados: list<string>}
     */
    private function progress(?ChecklistInspeccion $checklist): array
    {
        return [
            'estado' => $checklist?->estado,
            'items_completados' => $checklist ? $this->completedCodes($checklist) : [],
        ];
    }

    /**
     * Ticked item codes in catalog order.
     *
     * @return list<string>
     */
    private function completedCodes(ChecklistInspeccion $checklist): array
    {
        $ticked = $checklist->items()->pluck('item_codigo')->all();

        return array_values(array_intersect(InspeccionChecklist::codes(), $ticked));
    }
}
