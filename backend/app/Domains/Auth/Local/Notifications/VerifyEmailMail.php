<?php

declare(strict_types=1);

namespace App\Domains\Auth\Local\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Verificación de correo electrónico con OTP — story sc-117.
 *
 * Envía la notificación con el código OTP de 6 dígitos para que el usuario
 * lo ingrese en la pantalla /verify-email.
 */
class VerifyEmailMail extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly ?string $otp = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $verifyUrl = $this->verificationUrl($notifiable);

        $fromAddress = (string) (config('gmail.from_address') ?: config('mail.from.address') ?: 'noreply@dihm-muertos.site');
        $fromName = (string) (config('gmail.from_name') ?: config('mail.from.name') ?: config('app.name', 'Sistema de Incidencias'));

        $expireMinutes = 15;

        $mail = (new MailMessage)
            ->from($fromAddress, $fromName)
            ->subject('Código de verificación OTP - Sistema de Incidencias')
            ->greeting('¡Hola!')
            ->line('Gracias por registrarte en el Sistema de Incidencias.');

        if ($this->otp !== null) {
            $mail->line('Tu código de verificación de 6 dígitos es:')
                ->line("# **{$this->otp}**")
                ->line('Podés ingresarlo en la pantalla de verificación o hacer clic en el botón de abajo:');
        } else {
            $mail->line('Para activar tu cuenta y poder iniciar sesión, verificá tu correo electrónico en la aplicación.');
        }

        return $mail
            ->action('Ingresar código de verificación', $verifyUrl)
            ->line("Este código expirará en {$expireMinutes} minutos.")
            ->line('Si no creaste esta cuenta, podés ignorar este mensaje.')
            ->salutation('Saludos, el equipo del Sistema de Incidencias');
    }

    public function verificationUrl(object $notifiable): string
    {
        $frontendBase = (string) (config('app.frontend_url') ?: env('FRONTEND_URL') ?: env('FRONTEND_BASE_URL') ?: env('APP_URL') ?: 'http://localhost:3006');
        $email = urlencode((string) $notifiable->getEmailForVerification());

        return rtrim($frontendBase, '/').'/#/verify-email?email='.$email;
    }
}
