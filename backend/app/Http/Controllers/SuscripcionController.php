<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreComprobanteRequest;
use App\Models\ComprobantePago;
use App\Models\Concesionaria;
use App\Models\Suscripcion;
use App\Notifications\PaymentReceiptSubmittedNotification;
use App\Support\PaymentReceipts;
use App\Support\SuscripcionPresenter;
use App\Support\TransferData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

/**
 * Subscription payment of the signed-in dealer (pending or active; the route group
 * guarantees a dealer account).
 */
class SuscripcionController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(SuscripcionPresenter::present($request->user()->concesionaria));
    }

    /**
     * Save a payment receipt as "pendiente de revisión" and email the administrators.
     * The file is deleted if the database write fails; a mail failure never undoes the upload.
     */
    public function storeComprobante(StoreComprobanteRequest $request): JsonResponse
    {
        $dealer = $request->user()->concesionaria;

        if (TransferData::fromConfig() === null) {
            return response()->json(['message' => 'Los datos de transferencia no están disponibles por el momento.'], 503);
        }

        if ($dealer->comprobantes()->pendientes()->exists()) {
            return response()->json(['message' => 'Ya tenés un comprobante en revisión.'], 409);
        }

        $path = PaymentReceipts::store($dealer->id, $request->file('comprobante'));

        try {
            $receipt = DB::transaction(fn () => $this->createReceipt($dealer, $path));
        } catch (\Throwable $e) {
            PaymentReceipts::forget($path);

            throw $e;
        }

        $this->notifyAdmins($receipt, $dealer);

        return response()->json(SuscripcionPresenter::present($dealer), 201);
    }

    private function createReceipt(Concesionaria $dealer, string $path): ComprobantePago
    {
        $today = Carbon::today();
        $suscripcion = $dealer->suscripcion()->firstOrCreate([], [
            'estado' => Suscripcion::ESTADO_PENDIENTE,
            'vigente_desde' => $today,
        ]);

        // First activation starts today; a renewal starts the day after the current validity ends.
        $from = $suscripcion->vigente_hasta?->copy()->addDay() ?? $today;

        return $suscripcion->comprobantes()->create([
            'periodo_desde' => $from,
            'periodo_hasta' => $from->copy()->addMonth(),
            'archivo_url' => $path,
            'estado' => ComprobantePago::ESTADO_PENDIENTE_REVISION,
            'fecha_de_pago' => now(),
        ]);
    }

    private function notifyAdmins(ComprobantePago $receipt, Concesionaria $dealer): void
    {
        $emails = config('payments.admin_emails');

        if ($emails === []) {
            Log::warning('A payment receipt was uploaded but ADMIN_NOTIFICATION_EMAILS is empty.', [
                'comprobante_id' => $receipt->id,
            ]);

            return;
        }

        try {
            Notification::route('mail', $emails)->notify(new PaymentReceiptSubmittedNotification(
                $receipt,
                $dealer->nombre,
                SuscripcionPresenter::tipo($receipt->suscripcion),
            ));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
