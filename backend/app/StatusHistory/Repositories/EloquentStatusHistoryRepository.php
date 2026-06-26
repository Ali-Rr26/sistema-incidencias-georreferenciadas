<?php

declare(strict_types=1);

namespace App\StatusHistory\Repositories;

use App\Domains\Incidents\Models\Incident;
use App\StatusHistory\Models\StatusHistory;
use Illuminate\Support\Facades\DB;

class EloquentStatusHistoryRepository implements StatusHistoryRepository
{
    public function cambiarEstado(
        Incident $incident,
        string $newStatus,
        int $userId,
        ?string $comentario,
    ): StatusHistory {
        return DB::transaction(function () use ($incident, $newStatus, $userId, $comentario) {
            $previousStatus = $incident->status;

            $updateData = ['status' => $newStatus];

            // RF-FUNC-007 rule 1: record resolution_date when resolving
            if ($newStatus === Incident::STATUS_RESOLVED) {
                $updateData['resolution_date'] = now();
            }

            // RF-FUNC-007 rule 1: clear resolution_date if moving away from resolved
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
