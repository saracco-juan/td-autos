<?php

namespace App\Http\Controllers;

use App\Models\ComprobantePago;
use App\Support\PaymentReceipts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** The signed-in dealership's receipt history and private files (UH18). */
final class SubscriptionReceiptController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $receipts = $request->user()->concesionaria->comprobantes()->latest('id')->get();

        return response()->json($receipts->map(fn (ComprobantePago $receipt): array => [
            'id' => $receipt->id,
            'nombre_archivo' => PaymentReceipts::fileName($receipt->archivo_url),
            'periodo_desde' => $receipt->periodo_desde->toDateString(),
            'periodo_hasta' => $receipt->periodo_hasta->toDateString(),
            'enviado_en' => $receipt->fecha_de_pago?->toIso8601String(),
            'estado' => $receipt->estado,
            'fecha_revision' => $receipt->fecha_revision?->toIso8601String(),
            'motivo_rechazo' => $receipt->motivo_rechazo,
        ]));
    }

    public function file(Request $request, int $id): Response
    {
        // Resolve through ownership before touching private storage, including for inactive dealers.
        $receipt = $request->user()->concesionaria->comprobantes()->findOrFail($id);
        if (! PaymentReceipts::exists($receipt->archivo_url)) {
            return response()->json(['message' => 'No encontramos el archivo del comprobante.'], 404);
        }

        return PaymentReceipts::inline($receipt->archivo_url);
    }
}
