<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Observers;

use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\ResolutionAudit;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class IncidentResolutionAuditObserver
{
    public function updated(Incident $incident): void
    {
        try {
            $this->handleResolutionAudit($incident);
        } catch (\Throwable $e) {
            Log::warning('IncidentResolutionAuditObserver failed', [
                'incident_id' => $incident->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function handleResolutionAudit(Incident $incident): void
    {
        if (! $incident->wasChanged('status')) {
            return;
        }

        $previous = (string) $incident->getRawOriginal('status');
        $current = $incident->status;
        $currentValue = $current instanceof IncidentStatus ? $current->value : (string) $current;

        if ($previous !== IncidentStatus::Resolved->value && $currentValue === IncidentStatus::Resolved->value) {
            $userId = Auth::id();

            if ($userId === null) {
                Log::warning('IncidentResolutionAuditObserver: no authenticated user', [
                    'incident_id' => $incident->id,
                ]);

                return;
            }

            DB::afterCommit(function () use ($incident, $userId): void {
                try {
                    ResolutionAudit::create([
                        'incident_id' => $incident->id,
                        'resolved_by_user_id' => $userId,
                        'resolved_at' => $incident->resolution_date ?? now(),
                        'notes' => null,
                    ]);
                } catch (\Throwable $e) {
                    Log::warning('Failed to create resolution audit', [
                        'incident_id' => $incident->id,
                        'user_id' => $userId,
                        'error' => $e->getMessage(),
                    ]);
                }
            });
        }
    }
}
