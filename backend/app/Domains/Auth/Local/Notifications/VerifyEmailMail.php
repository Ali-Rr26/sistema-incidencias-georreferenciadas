<?php

declare(strict_types=1);

namespace App\Domains\Auth\Local\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;

/**
 * Verificación de correo electrónico — registro local (R8 del flujo
 * email-verification, story sc-117).
 *
 * Genera una URL firmada de Laravel (signed URL) hacia el endpoint
 * `verification.frontend` del frontend, que es la pantalla
 * `/verify-email` (story: "Handle verification link landing"). El
 * frontend extrae id/hash/expires/signature de la URL y los reenvía a
 * `GET /api/email/verify/{id}/{hash}` (mismo nombre de ruta API
 * `verification.verify`, protegida por middleware `signed`), que es
 * el que finalmente ejecuta `markEmailAsVerified()`.
 *
 * Configuración:
 *   - Expiración: 60 minutos (configurable vía
 *     `auth.verification.expire`, sigue la convención de Laravel).
 *   - Cola: `ShouldQueue` para no bloquear la respuesta HTTP de
 *     `POST /api/register`. El mail se entrega de forma asíncrona.
 *   - Copiado: usamos español (`messages.auth.verification_*`),
 *     siguiendo el patrón de `PasswordResetMail`.
 *   - Frontend: el host del enlace se reescribe a `config('app.frontend_url')`
 *     (con fallback a `FRONTEND_URL`/`FRONTEND_BASE_URL`/`APP_URL`),
 *     preservando path + query para que el backend siga verificando
 *     la firma.
 */
class VerifyEmailMail extends Notification implements ShouldQueue
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $verifyUrl = $this->verificationUrl($notifiable);

        $fromAddress = (string) (config('gmail.from_address') ?: config('mail.from.address') ?: 'noreply@dihm-muertos.site');
        $fromName = (string) (config('gmail.from_name') ?: config('mail.from.name') ?: config('app.name', 'Sistema de Incidencias'));

        $expireMinutes = (int) config('auth.verification.expire', 60);

        return (new MailMessage)
            ->from($fromAddress, $fromName)
            ->subject('Verifica tu correo electrónico - Sistema de Incidencias')
            ->greeting('¡Hola!')
            ->line('Gracias por registrarte en el Sistema de Incidencias.')
            ->line('Para activar tu cuenta y poder iniciar sesión, verificá tu correo electrónico haciendo clic en el siguiente enlace:')
            ->action('Verificar mi correo', $verifyUrl)
            ->line("Este enlace expirará en {$expireMinutes} minutos.")
            ->line('Si no creaste esta cuenta, podés ignorar este mensaje.')
            ->salutation('Saludos, el equipo del Sistema de Incidencias');
    }

    /**
     * Build the signed verification URL pointing at the frontend
     * `verify-email` screen, with all signed-URL parameters preserved
     * so the frontend can replay them to the API.
     *
     * The signed URL is generated for the API route `verification.verify`,
     * which is gated by the `signed` middleware that validates the
     * `signature` and `expires` query params against the API's APP_KEY.
     * We rewrite only the scheme+host to the frontend URL, leaving
     * the path and query intact — the frontend reads them and forwards
     * the same query params when it calls `GET /api/email/verify/{id}/{hash}`.
     */
    public function verificationUrl(object $notifiable): string
    {
        $apiSignedUrl = URL::temporarySignedRoute(
            'verification.verify',
            Carbon::now()->addMinutes((int) config('auth.verification.expire', 60)),
            [
                'id' => $notifiable->getKey(),
                'hash' => sha1((string) $notifiable->getEmailForVerification()),
            ],
        );

        $frontendBase = (string) (config('app.frontend_url') ?: env('FRONTEND_URL') ?: env('FRONTEND_BASE_URL') ?: env('APP_URL') ?: 'http://localhost:3006');

        $parsed = parse_url($apiSignedUrl);

        $scheme = $parsed['scheme'] ?? 'http';
        $path = $parsed['path'] ?? '';
        $query = $parsed['query'] ?? '';

        $signatureQuery = http_build_query([
            'id' => $notifiable->getKey(),
            'hash' => sha1((string) $notifiable->getEmailForVerification()),
            'expires' => $this->extractExpiresParam($query),
            'signature' => $this->extractSignatureParam($query),
        ]);

        return rtrim($frontendBase, '/')
            . '/#/verify-email?'
            . $signatureQuery;
    }

    /**
     * Parse the `expires` query param from a URL query string.
     */
    private function extractExpiresParam(string $query): string
    {
        parse_str($query, $params);

        return (string) ($params['expires'] ?? '');
    }

    /**
     * Parse the `signature` query param from a URL query string.
     */
    private function extractSignatureParam(string $query): string
    {
        parse_str($query, $params);

        return (string) ($params['signature'] ?? '');
    }
}
