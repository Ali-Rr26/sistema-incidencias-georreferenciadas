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

        // Pre-resolve the actor's full name AND role in the moment of the
        // transition so the resource can read them back without an N+1
        // query per row (IncidentNotificationObserver is the single funnel
        // for these notifications; either it fires or no row is created).
        // Doing this here also means the snapshot in `data.actor_name`
        // and `data.actor_role` stays stable even if the user later
        // changes their name or role assignment.
        $actorSnapshot = $this->resolveActorSnapshot($actorUserId);

        DB::afterCommit(function () use ($organizationId, $incidentId, $actorUserId, $actorSnapshot): void {
            // Hybrid admin_sistema scope (incident-approval-workflow/design.md §1 ADR-6):
            //   - admin_sistema with organization_id = X → only that org.
            //   - admin_sistema without organization_id  → global (cross-org).
            //   - admin_organizacion                      → only its own org.
            $admins = User::query()
                ->where(function ($query) use ($organizationId): void {
                    $query
                        ->where(function ($adminSistema) use ($organizationId): void {
                            $adminSistema->whereHas('role', fn ($role) => $role->where('name', UserRole::AdminSistema->value))
                                ->where(fn ($orgFilter) => $orgFilter->whereNull('organization_id')->orWhere('organization_id', $organizationId));
                        })
                        ->orWhere(function ($adminOrg) use ($organizationId): void {
                            $adminOrg->whereHas('role', fn ($role) => $role->where('name', UserRole::AdminOrganizacion->value))
                                ->where('organization_id', $organizationId);
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
                        'actor_name' => $actorSnapshot['name'],
                        'actor_role' => $actorSnapshot['role'],
                        'decision' => null,
                        'rejection_reason' => null,
                        'expires_at' => now()->addDays(7)->toIso8601String(),
                        'organization_id' => $organizationId,
                    ],
                );
            }
        });
    }

    /**
     * Resolve a user's display name AND role for snapshotting into
     * `data.actor_name` and `data.actor_role`. Returns null for both
     * when the user is unknown or soft-deleted, so the caller persists
     * null and the resource falls through to its legacy `User::find()`
     * path without a follow-up query.
     *
     * @return array{name: ?string, role: ?string}
     */
    private function resolveActorSnapshot(int $userId): array
    {
        $user = User::find($userId);
        if ($user === null) {
            return ['name' => null, 'role' => null];
        }

        $name = trim((string) ($user->first_name ?? '').' '.(string) ($user->last_name ?? ''));
        $role = $user->role?->name;

        return [
            'name' => $name !== '' ? $name : null,
            'role' => $role,
        ];
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
