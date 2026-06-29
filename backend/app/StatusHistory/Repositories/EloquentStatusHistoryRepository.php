<?php

declare(strict_types=1);

namespace App\StatusHistory\Repositories;

use App\Domains\Incidents\Models\Incident;
use App\StatusHistory\Models\StatusHistory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class EloquentStatusHistoryRepository implements StatusHistoryRepository
{
    public function byIncident(int $incidentId): Collection
    {
        return StatusHistory::with('user')
            ->where('incident_id', $incidentId)
            ->orderByDesc('created_at')
            ->get();
    }

    public function cambiarEstado(
        Incident $incident,
        string $newStatus,
        int $userId,
        ?string $comentario,
    ): StatusHistory {
        return DB::transaction(function () use ($incident, $newStatus, $userId, $comentario) {
            $previousStatus = $incident->status->value;

            $updateData = ['status' => $newStatus];

            // RF-FUNC-007 CP-02-05-B: set resolution_date when transitioning to resolved
            if ($newStatus === Incident::STATUS_RESOLVED) {
                $updateData['resolution_date'] = now();
            }

            // Clear resolution_date if moving away from resolved (except to closed)
            if ($previousStatus === Incident::STATUS_RESOLVED && $newStatus !== Incident::STATUS_CLOSED) {
                $updateData['resolution_date'] = null;
            }

            // Bypass the DB trigger so we control the history record completely
            // (correct user_id + comentario). The trigger handles SQL-direct changes.
            if (DB::connection()->getDriverName() === 'pgsql') {
                DB::statement("SET LOCAL session_replication_role = 'replica'");
            }

            $incident->update($updateData);

            return StatusHistory::create([
                'incident_id'     => $incident->id,
                'user_id'         => $userId,
                'previous_status' => $previousStatus,
                'new_status'      => $newStatus,
                'comentario'      => $comentario,
            ]);
        });
    }
}
