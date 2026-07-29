<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Observers;

use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Services\IncidentApprovalService;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Jobs\SendIncidentNotificationJob;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Notifications\Services\NotificationService;
use App\Domains\Users\Services\OperatorDashboardService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class IncidentNotificationObserver
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly IncidentApprovalService $approvalService,
    ) {}

    public function updated(Incident $incident): void
    {
        DB::afterCommit(fn () => OperatorDashboardService::clearCacheForIncident($incident));

        try {
            $this->handleClaimChange($incident);
            $this->handleReleaseChange($incident);
            $this->handleConfirmChange($incident);
            $this->handleResolvedPendingApproval($incident);
        } catch (\Throwable $e) {
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

        $previous = $incident->getRawOriginal('claimed_by');
        $current = $incident->claimed_by;

        if ($previous === null && $current !== null) {
            $this->queueNotification(
                $incident,
                NotificationType::Claim,
                "Tu incidencia \"{$incident->title}\" fue reclamada.",
                ['claimed_by' => $current],
            );
        }
    }

    private function handleReleaseChange(Incident $incident): void
    {
        if (! $incident->wasChanged('claimed_by')) {
            return;
        }

        $previous = $incident->getRawOriginal('claimed_by');
        $current = $incident->claimed_by;

        if ($previous !== null && $current === null) {
            $this->queueNotification(
                $incident,
                NotificationType::Assignment,
                "Tu incidencia \"{$incident->title}\" fue liberada.",
                ['released_from' => $previous],
            );
        }
    }

    public function handleConfirmChange(Incident $incident): void
    {
        try {
            if (! $incident->wasChanged('status')) {
                return;
            }

            $previous = (string) $incident->getRawOriginal('status');
            $current = $incident->status;
            $currentValue = $current instanceof IncidentStatus ? $current->value : (string) $current;

            // Solo notifica al ciudadano cuando la incidencia pasa a 'closed' (no en 'resolved').
            if ($previous !== IncidentStatus::Closed->value && $currentValue === IncidentStatus::Closed->value) {
                $this->notifications->notify(
                    $incident->user,
                    NotificationType::StatusChange,
                    "Tu incidencia \"{$incident->title}\" fue cerrada.",
                    $incident->id,
                    ['status' => 'closed'],
                );
            }
        } catch (\Throwable $e) {
            Log::warning('handleConfirmChange failed', ['incident_id' => $incident->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Dispara notificaciones a admins in-scope cuando la incidencia pasa a estado resolved.
     *
     * Solo cuando: previous ≠ resolved AND current = resolved.
     * Crea una notificacion por cada admin en pendingApprovalRecipients.
     */
    public function handleResolvedPendingApproval(Incident $incident): void
    {
        try {
            if (! $incident->wasChanged('status')) {
                return;
            }

            $previous = (string) $incident->getRawOriginal('status');
            $current = $incident->status;
            $currentValue = $current instanceof IncidentStatus ? $current->value : (string) $current;

            // Dispara solo cuando pasa de cualquier estado distinto de resolved → resolved.
            if ($previous === IncidentStatus::Resolved->value || $currentValue !== IncidentStatus::Resolved->value) {
                return;
            }

            $recipients = $this->approvalService->pendingApprovalRecipients($incident);

            foreach ($recipients as $recipient) {
                // Dedupe: evita notificaciones duplicadas (user, incident, type) dentro de 60s.
                $exists = Notification::query()
                    ->where('user_id', $recipient->id)
                    ->where('incident_id', $incident->id)
                    ->where('type', NotificationType::IncidentPendingApproval->value)
                    ->where('created_at', '>=', now()->subSeconds(60))
                    ->exists();

                if ($exists) {
                    continue;
                }

                $this->notifications->notify(
                    $recipient,
                    NotificationType::IncidentPendingApproval,
                    "La incidencia \"{$incident->title}\" requiere tu aprobación.",
                    $incident->id,
                    [
                        'status' => 'resolved',
                        'incident_id' => $incident->id,
                    ],
                );
            }
        } catch (\Throwable $e) {
            Log::warning('handleResolvedPendingApproval failed', ['incident_id' => $incident->id, 'error' => $e->getMessage()]);
        }
    }

    private function queueNotification(
        Incident $incident,
        NotificationType $type,
        string $message,
        array $data,
    ): void {
        $userId = (int) $incident->user_id;
        $incidentId = (int) $incident->id;

        if ($userId <= 0 || $incidentId <= 0) {
            return;
        }

        DB::afterCommit(function () use ($userId, $incidentId, $type, $message, $data): void {
            try {
                SendIncidentNotificationJob::dispatch(
                    $userId,
                    $incidentId,
                    $type->value,
                    $message,
                    $data,
                );
            } catch (\Throwable $e) {
                Log::warning('Failed to queue incident notification', [
                    'incident_id' => $incidentId,
                    'user_id' => $userId,
                    'type' => $type->value,
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }
}
