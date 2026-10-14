<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ComprobantePago;
use App\Services\Admin\AdminPresenter;
use App\Support\PaymentReceipts;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * A dealer's payment receipt under administrator review (RF19, CU-17).
 */
class ComprobanteController extends Controller
{
    public function show(ComprobantePago $comprobante): JsonResponse
    {
        return response()->json(AdminPresenter::receipt($comprobante));
    }

    /**
     * The receipt file lives on a private disk; only this route serves it.
     */
    public function file(ComprobantePago $comprobante): Response
    {
        if (! PaymentReceipts::exists($comprobante->archivo_url)) {
            return response()->json(['message' => 'No encontramos el archivo del comprobante.'], 404);
        }

        return PaymentReceipts::inline($comprobante->archivo_url);
    }
}
