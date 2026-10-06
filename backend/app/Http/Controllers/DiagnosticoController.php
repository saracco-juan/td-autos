<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaveDiagnosticoRequest;
use App\Models\Diagnostico;
use App\Models\TipoCarroceria;
use App\Support\DiagnosticoOptions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DiagnosticoController extends Controller
{
    /**
     * The authenticated user's diagnosis (or null) plus the body-type catalog.
     */
    public function show(Request $request): JsonResponse
    {
        $diagnostico = Diagnostico::where('usuario_id', $request->user()->id)->first();

        return response()->json([
            'diagnostico' => $diagnostico ? $this->answers($diagnostico) : null,
            'carrocerias' => TipoCarroceria::orderBy('id')->get(['id', 'nombre']),
        ]);
    }

    /**
     * Create or replace the authenticated user's single diagnosis.
     */
    public function save(SaveDiagnosticoRequest $request): JsonResponse
    {
        $answers = $request->validated();

        $diagnostico = DB::transaction(function () use ($request, $answers) {
            $diagnostico = Diagnostico::updateOrCreate(
                ['usuario_id' => $request->user()->id],
                DiagnosticoOptions::toColumns($answers) + ['estado' => 'completo', 'actualizado_en' => now()],
            );
            $diagnostico->carrocerias()->sync($answers['carrocerias']);

            return $diagnostico;
        });

        return response()->json(['diagnostico' => $this->answers($diagnostico)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function answers(Diagnostico $diagnostico): array
    {
        $ids = $diagnostico->carrocerias()
            ->orderBy('tipo_carroceria.id')
            ->pluck('tipo_carroceria.id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return DiagnosticoOptions::toAnswers($diagnostico, $ids);
    }
}
