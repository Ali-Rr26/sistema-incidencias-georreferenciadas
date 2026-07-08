<?php

declare(strict_types=1);

namespace App\StatusHistory\Interfaces;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Status history for an incident.
 *
 * Reads from the `status_history` table. Rows are inserted automatically by
 * the PostgreSQL trigger `trg_log_incident_status` (see migration
 * 2026_06_15_000010_create_incident_triggers) on every UPDATE that changes
 * `status`. User attribution comes from `NEW.user_id` at trigger time, so
 * the "actor" recorded here is the incident's reporter, not necessarily the
 * user who changed the status. The frontend can show this with appropriate
 * framing.
 */
class StatusHistoryController
{
    public function index(Request $request, int $incidentId): JsonResponse
    {
        $rows = DB::table('status_history')
            ->where('incident_id', $incidentId)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get(['id', 'user_id', 'previous_status', 'new_status', 'created_at']);

        return response()->json([
            'data' => $rows->map(fn ($r) => [
                'id' => (int) $r->id,
                'user_id' => (int) $r->user_id,
                'previous_status' => $r->previous_status,
                'new_status' => $r->new_status,
                'created_at' => $r->created_at,
            ])->all(),
        ]);
    }
}
