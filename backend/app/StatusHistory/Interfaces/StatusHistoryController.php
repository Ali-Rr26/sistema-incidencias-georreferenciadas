<?php

declare(strict_types=1);

namespace App\StatusHistory\Interfaces;

use App\StatusHistory\Models\StatusHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StatusHistoryController
{
    public function index(Request $request, int $incidentId): JsonResponse
    {
        $history = StatusHistory::with('user:id,name,email')
            ->where('incident_id', $incidentId)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn (StatusHistory $entry) => [
                'id'              => $entry->id,
                'incident_id'     => $entry->incident_id,
                'previous_status' => [
                    'value' => $entry->previous_status->value,
                    'label' => $entry->previous_status->label(),
                ],
                'new_status' => [
                    'value' => $entry->new_status->value,
                    'label' => $entry->new_status->label(),
                ],
                'comment'    => $entry->comment,
                'user'       => $entry->user ? [
                    'id'    => $entry->user->id,
                    'name'  => $entry->user->name,
                    'email' => $entry->user->email,
                ] : null,
                'created_at' => $entry->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $history]);
    }
}
