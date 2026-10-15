<?php

namespace App\Notifications;

use App\Models\ComprobantePago;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tells the dealer what the administrator decided about its payment receipt (RF19, TC-51).
 */
class PaymentReceiptReviewedNotification extends Notification
{
    public function __construct(
        private readonly ComprobantePago $receipt,
        private readonly bool $activated,
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
        return $this->receipt->estado === ComprobantePago::ESTADO_APROBADO
            ? $this->approved()
            : $this->rejected();
    }

    private function approved(): MailMessage
    {
        $from = $this->receipt->periodo_desde->format('d/m/Y');
        $to = $this->receipt->periodo_hasta->format('d/m/Y');

        $mail = (new MailMessage)
            ->subject('Aprobamos tu comprobante de pago')
            ->line('Revisamos el comprobante de pago que enviaste y lo aprobamos.')
            ->line("Tu suscripción está vigente del {$from} al {$to}.");

        if ($this->activated) {
            $mail->line('Tu concesionaria ya está activa: ya podés gestionar tu inventario.');
        }

        return $mail->salutation('Equipo de TD Autos');
    }

    private function rejected(): MailMessage
    {
        return (new MailMessage)
            ->subject('Rechazamos tu comprobante de pago')
            ->line('Revisamos el comprobante de pago que enviaste y no lo pudimos aprobar.')
            ->line("Motivo: {$this->receipt->motivo_rechazo}")
            ->line('Podés subir un nuevo comprobante desde la sección de suscripción.')
            ->salutation('Equipo de TD Autos');
    }
}
