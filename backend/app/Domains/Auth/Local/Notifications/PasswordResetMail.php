<?php

declare(strict_types=1);

namespace App\Domains\Auth\Local\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordResetMail extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $token,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $baseUrl = config('app.frontend_url')
            ?: env('FRONTEND_URL')
            ?: env('FRONTEND_BASE_URL')
            ?: env('APP_URL')
            ?: 'http://localhost:3006';

        $url = rtrim((string) $baseUrl, '/')
            . '/#/reset-password?token=' . $this->token
            . '&email=' . urlencode($notifiable->email);

        return (new MailMessage)
            ->subject('Restablecer contraseña - Sistema de Incidencias')
            ->greeting('¡Hola!')
            ->line('Recibiste este correo porque solicitaste restablecer tu contraseña.')
            ->action('Restablecer contraseña', $url)
            ->line('Este enlace expirará en 60 minutos.')
            ->line('Si no solicitaste este cambio, puedes ignorar este mensaje.')
            ->salutation('Saludos, el equipo del Sistema de Incidencias');
    }
}
