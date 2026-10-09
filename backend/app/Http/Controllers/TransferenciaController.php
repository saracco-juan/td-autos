<?php

namespace App\Http\Controllers;

use App\Http\Requests\ToggleTransferenciaItemRequest;
use App\Models\ChecklistTransferencia;
use App\Support\TransferenciaChecklist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransferenciaController extends Controller
{
    /**
     * The stage catalog, the authenticated user's marks (without creating a checklist) and the advisor contact.
     */
    public function show(Request $request): JsonResponse
    {
        $checklist = $this->checklistOf($request);

        return response()->json([
            'etapas' => TransferenciaChecklist::stages(),
        ] + $this->progress($checklist) + [
            'asesor_whatsapp' => $this->advisorWhatsapp(),
        ]);
    }

    /**
     * Tick or untick one item. Any change puts the checklist back in progress.
     */
    public function toggle(ToggleTransferenciaItemRequest $request, string $codigo): JsonResponse
    {
        $completado = $request->boolean('completado');

        $checklist = DB::transaction(function () use ($request, $codigo, $completado) {
            $checklist = $completado
                ? ChecklistTransferencia::createOrFirst(
                    ['usuario_id' => $request->user()->id],
                    ['estado' => ChecklistTransferencia::EN_CURSO, 'actualizado_en' => now()],
                )
                : $this->checklistOf($request);

            if ($checklist === null) {
                return null;
            }

            if ($completado) {
                $checklist->items()->createOrFirst(['etapa_codigo' => $codigo], ['completada_en' => now()]);
            } else {
                $checklist->items()->where('etapa_codigo', $codigo)->delete();
            }

            $checklist->update(['estado' => ChecklistTransferencia::EN_CURSO, 'actualizado_en' => now()]);

            return $checklist;
        });

        return response()->json($this->progress($checklist));
    }

    /**
     * Close the checklist as complete (all items ticked) or incomplete. Pending mandatory items
     * are warned about by the client before the summary, so this never rejects.
     */
    public function finish(Request $request): JsonResponse
    {
        $checklist = DB::transaction(function () use ($request) {
            $checklist = ChecklistTransferencia::createOrFirst(
                ['usuario_id' => $request->user()->id],
                ['estado' => ChecklistTransferencia::INCOMPLETA, 'actualizado_en' => now()],
            );

            $complete = count($this->completedCodes($checklist)) === count(TransferenciaChecklist::codes());
            $checklist->update([
                'estado' => $complete ? ChecklistTransferencia::COMPLETA : ChecklistTransferencia::INCOMPLETA,
                'actualizado_en' => now(),
            ]);

            return $checklist;
        });

        return response()->json($this->progress($checklist));
    }

    private function checklistOf(Request $request): ?ChecklistTransferencia
    {
        return ChecklistTransferencia::where('usuario_id', $request->user()->id)->first();
    }

    /**
     * The configured advisor number reduced to digits (the form wa.me expects), or null when there is none.
     */
    private function advisorWhatsapp(): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) config('services.transfer_advisor.whatsapp'));

        return $digits === '' ? null : $digits;
    }

    /**
     * @return array{estado: string|null, items_completados: list<string>}
     */
    private function progress(?ChecklistTransferencia $checklist): array
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
    private function completedCodes(ChecklistTransferencia $checklist): array
    {
        $ticked = $checklist->items()->pluck('etapa_codigo')->all();

        return array_values(array_intersect(TransferenciaChecklist::codes(), $ticked));
    }
}
