<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Observers;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\StatusHistory;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Audits all status changes to the Incident model by recording
 * each transition in the status_history table.
 *
 * Guarantees:
 *   - Every status change is recorded atomically within DB::transaction()
 *   - Old status, new status, user ID, and timestamp are captured
 *   - Gracefully handles null user (unauthenticated updates)
 *   - Logs warnings if status_history creation fails (doesn't abort incident update)
 */
class IncidentStatusHistoryObserver
{
    public function updating(Incident $incident): void
    {
        // Check if status field is actually being modified
        if (!$incident->isDirty('status')) {
            return;
        }

        $oldStatus = $incident->getOriginal('status');
        $newStatus = $incident->getAttribute('status');

        // Record status change in a database transaction to ensure atomicity
        try {
            DB::transaction(function () use ($incident, $oldStatus, $newStatus) {
                StatusHistory::create([
                    'incident_id' => $incident->id,
                    'status_old' => (string) $oldStatus,
                    'status_new' => (string) $newStatus,
                    'changed_by_user_id' => Auth::id(),
                    'changed_at' => now(),
                ]);
            });
        } catch (\Throwable $e) {
            // Don't let status_history recording failure abort the incident update
            // The incident state change is more important than the audit trail entry
            Log::warning('IncidentStatusHistoryObserver failed to record status change', [
                'incident_id' => $incident->id,
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);
        }
    }
}