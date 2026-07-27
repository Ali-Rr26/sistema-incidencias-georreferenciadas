<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Observers;

use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Jobs\SendIncidentNotificationJob;
use App\Domains\Notifications\Services\NotificationService;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Users\Models\User;
use App\Domains\Users\Services\OperatorDashboardService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class IncidentNotificationObserver
{
    public function updated(Incident $incident): void
    {
        DB::afterCommit(fn () => OperatorDashboardService::clearCacheForIncident($incident));

        try {
            $this->handleClaimChange($incident);
            $this->handleReleaseChange($incident);
            $this->handleConfirmChange($incident);
            $this->handleAdminApprovalChange($incident);
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

    private function handleAdminApprovalChange(Incident $incident): void
    {
        if (! $incident->wasChanged('status')) {
            return;
        }

        $previous = (string) $incident->getRawOriginal('status');
        $current = $incident->status instanceof IncidentStatus
            ? $incident->status->value
            : (string) $incident->status;

        if ($previous === IncidentStatus::Resolved->value || $current !== IncidentStatus::Resolved->value) {
            return;
        }

        $organizationId = (int) $incident->organization_id;
        $incidentId = (int) $incident->id;
        $actorUserId = (int) ($incident->claimed_by ?: $incident->user_id);

        DB::afterCommit(function () use ($organizationId, $incidentId, $actorUserId): void {
            $admins = User::query()
                ->where(function ($query) use ($organizationId): void {
                    $query->whereHas('role', fn ($role) => $role->where('name', UserRole::AdminSistema->value))
                        ->orWhere(function ($organizationQuery) use ($organizationId): void {
                            $organizationQuery->where('organization_id', $organizationId)
                                ->whereHas('role', fn ($role) => $role->where('name', UserRole::AdminOrganizacion->value));
                        });
                })
                ->get();

            $service = app(NotificationService::class);
            foreach ($admins as $admin) {
                $service->notify(
                    user: $admin,
                    type: NotificationType::IncidenciaAtendidaParaAprobacion,
                    message: 'Una incidencia atendida requiere tu aprobación.',
                    incidentId: $incidentId,
                    data: [
                        'incident_id' => $incidentId,
                        'actor_user_id' => $actorUserId,
                        'decision' => null,
                        'rejection_reason' => null,
                        'expires_at' => now()->addDays(7)->toIso8601String(),
                        'organization_id' => $organizationId,
                    ],
                );
            }
        });
    }

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
