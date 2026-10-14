<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RejectComprobanteRequest;
use App\Models\ComprobantePago;
use App\Services\Admin\AdminPresenter;
use App\Services\Subscription\ReceiptAlreadyReviewedException;
use App\Services\Subscription\ReceiptReview;
use App\Support\PaymentReceipts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A dealer's payment receipt under administrator review (RF19, CU-17).
 */
class ComprobanteController extends Controller
{
    public const MESSAGE_ALREADY_REVIEWED = 'Este comprobante ya fue revisado.';

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

    /**
     * TC-49: approve and activate the dealer on its first payment.
     */
    public function approve(Request $request, ComprobantePago $comprobante, ReceiptReview $review): JsonResponse
    {
        return $this->decided(fn () => $review->approve($comprobante, $request->user()));
    }

    /**
     * TC-50, TC-51: reject with the reason the dealer will read.
     */
    public function reject(RejectComprobanteRequest $request, ComprobantePago $comprobante, ReceiptReview $review): JsonResponse
    {
        return $this->decided(fn () => $review->reject($comprobante, $request->user(), $request->validated('motivo_rechazo')));
    }

    /**
     * @param  callable(): ComprobantePago  $decide
     */
    private function decided(callable $decide): JsonResponse
    {
        try {
            $receipt = $decide();
        } catch (ReceiptAlreadyReviewedException) {
            return response()->json(['message' => self::MESSAGE_ALREADY_REVIEWED], 409);
        }

        return response()->json(AdminPresenter::receipt($receipt->fresh()));
    }
}
