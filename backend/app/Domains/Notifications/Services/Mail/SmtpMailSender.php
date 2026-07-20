<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Services\Mail;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Notifications\Mail\IncidentAssignedMail;
use App\Domains\Users\Models\User;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Support\Facades\Log;

/**
 * Implementación SMTP del contrato MailSenderInterface.
 *
 * Esta clase es SINGLETON (registrada en AppServiceProvider::register)
 * porque la instancia solo guarda dependencias inyectadas y el resolver
 * se usa siempre con la misma configuración SMTP. No mantener estado
 * mutable aquí — `sendAssignedIncident()` es una operación fire-and-forget.
 *
 * Precedencia de configuración (de mayor a menor):
 *
 *   1. `config('gmail.*')` y `config('gmail.from_address')` — dedicado
 *      al envío de notificaciones de asignación vía SMTP genérico (no
 *      exclusivamente Gmail: cualquier host que hable SMTP funciona).
 *      Se setea vía vars `GMAIL_*` en `.env`.
 *
 *   2. `config('mail.from.address')` — fallback automático si la sección
 *      `gmail.from_address` está vacía. Garantiza que el mail salga con
 *      un `from` razonable incluso en entornos sin GMAIL_* configuradas.
 *
 * El from Name sigue el mismo patrón (`gmail.from_name` → `mail.from.name`).
 *
 * Tolerancia a fallos (S-7):
 *
 *   `sendAssignedIncident()` envuelve `Mailer::to()->send()` en
 *   try/catch. Si el SMTP falla (host inalcanzable, auth error,
 *   timeout, etc.) el método NO propaga: registra `Log::warning` con
 *   contexto (user, incident, role, error) y retorna. Esto sigue el
 *   patrón de `AssignmentNotificationObserver::created()` y de
 *   `NotificationService::publish()` — un fallo de mail nunca debe
 *   romper la fila en `assignments` que es lo importante para el
 *   negocio.
 */
class SmtpMailSender implements MailSenderInterface
{
    public function __construct(
        private readonly Mailer $mailer,
    ) {}

    public function sendAssignedIncident(User $user, Incident $incident, string $assignmentRole): void
    {
        $fromAddress = $this->resolveFromAddress();
        $fromName = $this->resolveFromName();

        $mailable = new IncidentAssignedMail($user, $incident, $assignmentRole);
        // El framework espera `$mailable->from` como array de filas
        // [['address' => ..., 'name' => ...]] (ver Mailable::buildFrom()
        // línea 463 de Illuminate/Mail/Mailable.php). Por eso el doble
        // array anidado, no key-value simple.
        $mailable->from = [
            [
                'address' => $fromAddress,
                'name' => $fromName,
            ],
        ];

        try {
            $this->mailer->to($user->email)->send($mailable);
        } catch (\Throwable $e) {
            Log::warning('AssignmentNotification mail failed', [
                'user_id' => $user->id,
                'incident_id' => $incident->id,
                'role' => $assignmentRole,
                'from' => $fromAddress,
                'error' => $e->getMessage(),
            ]);

            return;
        }

        Log::info('AssignmentNotification mail sent', [
            'user_id' => $user->id,
            'incident_id' => $incident->id,
            'role' => $assignmentRole,
            'email_sent' => true,
        ]);
    }

    private function resolveFromAddress(): string
    {
        $gmail = (string) config('gmail.from_address', '');
        if ($gmail !== '') {
            return $gmail;
        }

        return (string) config('mail.from.address', 'hello@example.com');
    }

    private function resolveFromName(): string
    {
        $gmail = (string) config('gmail.from_name', '');
        if ($gmail !== '') {
            return $gmail;
        }

        return (string) config('mail.from.name', (string) config('app.name', 'Sistema de Incidencias'));
    }
}
