<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends ResetPassword
{
    /**
     * @param  mixed  $notifiable
     */
    public function toMail($notifiable): MailMessage
    {
        return $this->buildMailMessage($this->resetUrl($notifiable))
            ->greeting("Hola {$notifiable->name}");
    }

    /**
     * @param  string  $url
     */
    protected function buildMailMessage($url): MailMessage
    {
        $broker = config('auth.defaults.passwords');
        $minutes = config("auth.passwords.{$broker}.expire");

        return (new MailMessage)
            ->subject('Restablecé tu contraseña de TD Autos')
            ->line('Recibimos un pedido para restablecer la contraseña de tu cuenta de TD Autos.')
            ->action('RESTABLECER CONTRASEÑA', $url)
            ->line("Este enlace de restablecimiento vence en {$minutes} minutos.")
            ->line('Si no pediste restablecer tu contraseña, ignorá este mensaje: tu cuenta sigue segura.')
            ->salutation('Equipo de TD Autos');
    }
}
