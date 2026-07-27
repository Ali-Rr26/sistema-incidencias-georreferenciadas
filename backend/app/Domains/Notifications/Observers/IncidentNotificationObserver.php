<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Observers;

use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Jobs\SendIncidentNotificationJob;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class IncidentNotificationObserver
{
    public function updated(Incident $incident): void
    {
        \App\Domains\Users\Services\OperatorDashboardService::clearCacheForIncident($incident);

        try {
            $this->handleClaimChange($incident);
            $this->handleReleaseChange($incident);
            $this->handleConfirmChange($incident);
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

    private function handleConfirmChange(Incident $incident): void
    {
        if (! $incident->wasChanged('status')) {
            return;
        }

        $previous = (string) $incident->getRawOriginal('status');
        $current = $incident->status;
        $currentValue = $current instanceof IncidentStatus ? $current->value : (string) $current;

        if ($previous !== IncidentStatus::Resolved->value && $currentValue === IncidentStatus::Resolved->value) {
            $this->queueNotification(
                $incident,
                NotificationType::StatusChange,
                "Tu incidencia \"{$incident->title}\" fue resuelta.",
                ['status' => IncidentStatus::Resolved->value],
            );
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
