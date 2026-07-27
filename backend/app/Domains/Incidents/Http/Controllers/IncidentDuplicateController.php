<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Controllers;

use App\Domains\Incidents\Http\Policies\IncidentDuplicatePolicy;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentDuplicate;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * HTTP shell for the manual duplicate-marking sub-resource.
 *
 *   POST   /api/incidents/{incident}/duplicates                     — auth
 *   GET    /api/incidents/{incident}/duplicates                     — public (confirmed only)
 *   PATCH  /api/incidents/{incident}/duplicates/{duplicate}         — staff
 *
 * Only staff (`admin_sistema | admin_organizacion | operador_sistema |
 * operador_organizacion`) can transition status. Endpoints are keyed off
 * the CANONICAL incident id (the one others are marked as duplicating);
 * the duplicate-incident id lives in the request body / URL.
 *
 * The DB has a CHECK constraint on `status` and a unique composite index
 * on `(original_incident_id, duplicate_incident_id)` — both Postgres-only
 * but the `firstOrCreate` here keeps the app layer safe in sqlite tests.
 */
class IncidentDuplicateController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly IncidentDuplicatePolicy $policy,
    ) {
        // The shallow route uses {duplicate} as the route param. Laravel
        // guessPolicyNamesUsing would resolve to IncidentDuplicatePolicy
        // from the model namespace, but we wire it explicitly here so the
        // wiring is obvious for the next reader.
    }

    public function index(Request $request, Incident $incident): JsonResponse
    {
        $rows = IncidentDuplicate::query()
            ->where('original_incident_id', $incident->id)
            ->where('status', 'confirmed')
            ->with('duplicate:id,title,status,created_at')
            ->orderBy('reviewed_at', 'desc')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (IncidentDuplicate $d) => [
                'id' => (int) $d->id,
                'duplicate_incident_id' => (int) $d->duplicate_incident_id,
                'reason' => $d->reason,
                'reviewed_at' => $d->reviewed_at?->toIso8601String(),
                'duplicate' => $d->duplicate ? [
                    'id' => (int) $d->duplicate->id,
                    'title' => $d->duplicate->title,
                    'status' => $d->duplicate->status?->value,
                    'created_at' => $d->duplicate->created_at?->toIso8601String(),
                ] : null,
            ])->values(),
            'meta' => [
                'total' => $rows->count(),
            ],
        ]);
    }

    public function store(Request $request, Incident $incident): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            abort(401);
        }

        $this->policy->create($user);

        $validated = $request->validate([
            'duplicate_incident_id' => ['required', 'integer', 'different:incident_id', 'exists:incidents,id'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $duplicateId = (int) $validated['duplicate_incident_id'];

        // No self-marking: don't allow marking incident X as duplicate of itself.
        if ($duplicateId === (int) $incident->id) {
            abort(422, 'Una incidencia no puede ser duplicada de sí misma.');
        }

        $link = IncidentDuplicate::firstOrCreate(
            [
                'original_incident_id' => $incident->id,
                'duplicate_incident_id' => $duplicateId,
            ],
            [
                'reported_by_user_id' => $user->id,
                'reason' => $validated['reason'] ?? null,
                'status' => 'pending',
            ],
        );

        if ($link->wasRecentlyCreated) {
            $this->bumpDuplicateCount($incident->id, +1);
        }

        return response()->json([
            'data' => $this->payload($link),
        ], 201);
    }

    public function update(
        Request $request,
        Incident $incident,
        IncidentDuplicate $duplicate,
    ): JsonResponse {
        $user = $request->user();

        if ($user === null) {
            abort(401);
        }

        // Scope check: the {duplicate} must belong to the {incident} that's in the URL.
        if ((int) $duplicate->original_incident_id !== (int) $incident->id) {
            abort(404);
        }

        $this->authorize('update', $duplicate);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:confirmed,rejected'],
        ]);

        $oldStatus = $duplicate->status;
        $newStatus = $validated['status'];

        DB::transaction(function () use ($duplicate, $newStatus, $user): void {
            $duplicate->update([
                'status' => $newStatus,
                'reviewed_by_user_id' => $user->id,
                'reviewed_at' => now(),
            ]);
        });

        // The duplicates_count on the canonical incident only counts
        // CONFIRMED rows. Transitions in/out of 'confirmed' must move
        // the counter accordingly.
        if ($oldStatus !== 'confirmed' && $newStatus === 'confirmed') {
            $this->bumpDuplicateCount($incident->id, +1);
        } elseif ($oldStatus === 'confirmed' && $newStatus !== 'confirmed') {
            $this->bumpDuplicateCount($incident->id, -1);
        }

        return response()->json([
            'data' => $this->payload($duplicate->fresh()),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(IncidentDuplicate $d): array
    {
        return [
            'id' => (int) $d->id,
            'original_incident_id' => (int) $d->original_incident_id,
            'duplicate_incident_id' => (int) $d->duplicate_incident_id,
            'reported_by_user_id' => (int) $d->reported_by_user_id,
            'reason' => $d->reason,
            'status' => $d->status,
            'reviewed_by_user_id' => $d->reviewed_by_user_id !== null ? (int) $d->reviewed_by_user_id : null,
            'reviewed_at' => $d->reviewed_at?->toIso8601String(),
            'created_at' => $d->created_at?->toIso8601String(),
            'updated_at' => $d->updated_at?->toIso8601String(),
        ];
    }

    private function bumpDuplicateCount(int $incidentId, int $delta): void
    {
        try {
            DB::afterCommit(function () use ($incidentId, $delta): void {
                try {
                    \Illuminate\Support\Facades\Redis::hincrby(
                        sprintf('incident:%d', $incidentId),
                        'duplicates_count',
                        $delta,
                    );
                } catch (\Throwable $e) {
                    Log::warning('duplicates.redis_increment_failed', [
                        'incident_id' => $incidentId,
                        'delta' => $delta,
                        'error' => $e->getMessage(),
                    ]);
                }
            });
        } catch (\Throwable $e) {
            Log::warning('duplicates.after_commit_failed', [
                'incident_id' => $incidentId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
