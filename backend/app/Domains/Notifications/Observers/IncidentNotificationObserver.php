<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Observers;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Services\NotificationService;
use App\Domains\Users\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Crea notificaciones a partir de cambios en Incident.
 *
 * Eventos cubiertos:
 *  - claim (claimed_by pasa de null a un usuario) → notifica al usuario que reporta la incidencia
 *  - release (claimed_by pasa de un usuario a null) → notifica al usuario que reporta
 *  - confirm (status pasa a resolved y se asigna organización) → notifica al usuario que reportó
 *
 * Este observer NO se dispara para cambios que no afecten al dueño de la
 * incidencia. La deduplicación (60s) está dentro de NotificationService.
 */
class IncidentNotificationObserver
{
    public function __construct(
        private readonly NotificationService $service,
    ) {}

    public function updated(Incident $incident): void
    {
        try {
            $this->handleClaimChange($incident);
            $this->handleReleaseChange($incident);
            $this->handleConfirmChange($incident);
        } catch (\Throwable $e) {
            // No queremos que un fallo de notificaciones rompa el flujo principal.
            Log::warning('IncidentNotificationObserver failed', [
                'incident_id' => $incident->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function handleClaimChange(Incident $incident): void
    {
        if (! $incident->wasChanged('claimed_by')) {
            return;
        }

        $previous = $incident->getOriginal('claimed_by');
        $current = $incident->claimed_by;

        if ($previous === null && $current !== null) {
            // Claim — notifica al dueño de la incidencia
            $owner = $incident->user;
            if ($owner === null) {
                return;
            }
            $this->service->notify(
                user: $owner,
                type: NotificationType::Claim,
                message: "Tu incidencia \"{$incident->title}\" fue reclamada.",
                incidentId: $incident->id,
                data: ['claimed_by' => $current],
            );
        }
    }

    private function handleReleaseChange(Incident $incident): void
    {
        if (! $incident->wasChanged('claimed_by')) {
            return;
        }

        $previous = $incident->getOriginal('claimed_by');
        $current = $incident->claimed_by;

        if ($previous !== null && $current === null) {
            $owner = $incident->user;
            if ($owner === null) {
                return;
            }
            $this->service->notify(
                user: $owner,
                type: NotificationType::Assignment,
                message: "Tu incidencia \"{$incident->title}\" fue liberada.",
                incidentId: $incident->id,
                data: ['released_from' => $previous],
            );
        }
    }

    private function handleConfirmChange(Incident $incident): void
    {
        if (! $incident->wasChanged('status')) {
            return;
        }

        $previous = $incident->getOriginal('status');
        $current = (string) $incident->status?->value;

        // "resolved" es el estado terminal — confirma la incidencia.
        if ($previous !== 'resolved' && $current === 'resolved') {
            $owner = $incident->user;
            if ($owner === null) {
                return;
            }
            $this->service->notify(
                user: $owner,
                type: NotificationType::StatusChange,
                message: "Tu incidencia \"{$incident->title}\" fue resuelta.",
                incidentId: $incident->id,
                data: ['status' => 'resolved'],
            );
        }
    }
}