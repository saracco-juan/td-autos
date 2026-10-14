<?php

namespace App\Notifications;

use App\Models\ComprobantePago;
use App\Support\PaymentReceipts;
use App\Support\SuscripcionPresenter;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tells the administrators a dealer uploaded a payment receipt. The file travels attached
 * because they have no review screen yet.
 */
class PaymentReceiptSubmittedNotification extends Notification
{
    public function __construct(
        private readonly ComprobantePago $receipt,
        private readonly string $dealerName,
        private readonly string $tipo,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $kind = $this->tipo === SuscripcionPresenter::TIPO_ALTA ? 'Alta inicial' : 'Renovación mensual';
        $path = $this->receipt->archivo_url;

        return (new MailMessage)
            ->subject("Nuevo comprobante de pago de {$this->dealerName}")
            ->line("La concesionaria {$this->dealerName} envió un comprobante de pago por transferencia.")
            ->line("Tipo de pago: {$kind}")
            ->line("Período: {$this->receipt->periodo_desde->format('d/m/Y')} al {$this->receipt->periodo_hasta->format('d/m/Y')}")
            ->line("Fecha de carga: {$this->receipt->fecha_de_pago->format('d/m/Y')}")
            ->line('El comprobante va adjunto a este mensaje.')
            ->attachData(
                PaymentReceipts::disk()->get($path),
                PaymentReceipts::fileName($path),
                ['mime' => PaymentReceipts::disk()->mimeType($path) ?: 'application/octet-stream'],
            )
            ->salutation('Equipo de TD Autos');
    }
}
