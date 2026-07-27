<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Controllers;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\MeTooReport;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * HTTP shell for the "yo también reporto" (me-too) sub-resource.
 *
 *   POST   /api/incidents/{incident}/me-too        — auth, idempotent
 *   DELETE /api/incidents/{incident}/me-too        — auth, idempotent
 *   GET    /api/incidents/{incident}/me-too        — public (count + viewer_has_me_too)
 *   GET    /api/incidents/{incident}/me-too/users  — auth, paginated list
 *
 * Reads and writes the Redis hash `incident:{id}` → `me_too_count` so the
 * feed read model stays consistent. The author counts live in Postgres
 * (authoritative) and Redis is rebuilt by `feed:rebuild` (also authoritative).
 * Live writes use `HINCRBY` so the projection matches the comment_count
 * precedent in {@see \App\Domains\Comments\Jobs\SyncCommentToRedisJob}.
 */
class MeTooController extends Controller
{
    use AuthorizesRequests;

    private const REDIS_HASH_KEY = 'incident:%d';

    public function store(Request $request, Incident $incident): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            abort(401);
        }

        // Idempotent insert: firstOrCreate silently no-ops on duplicate
        // (the unique composite index on (incident_id, user_id) is the
        // BACKSTOP — application-level here, just to avoid the round-trip
        // to the DB IntegrityException path).
        $report = MeTooReport::firstOrCreate(
            [
                'incident_id' => $incident->id,
                'user_id' => $user->id,
            ],
            [
                'created_at' => now(),
            ],
        );

        // Only HINCRBY when we actually inserted (firstOrCreate returns the
        // existing row on duplicate, so $report->wasRecentlyCreated === false).
        if ($report->wasRecentlyCreated) {
            $this->bumpRedisCount($incident->id, +1);
        }

        return response()->json([
            'data' => $this->payload($incident, $user->id),
        ], 201);
    }

    public function destroy(Request $request, Incident $incident): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            abort(401);
        }

        $deleted = MeTooReport::query()
            ->where('incident_id', $incident->id)
            ->where('user_id', $user->id)
            ->delete();

        if ($deleted > 0) {
            $this->bumpRedisCount($incident->id, -1);
        }

        return response()->json(null, 204);
    }

    public function show(Request $request, Incident $incident): JsonResponse
    {
        $userId = $request->user()?->id;

        return response()->json([
            'data' => $this->payload($incident, $userId),
        ]);
    }

    public function users(Request $request, Incident $incident): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            abort(401);
        }

        $perPage = (int) $request->integer('per_page', 20);
        $perPage = max(1, min($perPage, 100));

        $rows = MeTooReport::query()
            ->where('incident_id', $incident->id)
            ->with('user:id,first_name,last_name,avatar')
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json([
            'data' => $rows->getCollection()->map(fn (MeTooReport $r) => [
                'id' => (int) $r->id,
                'user' => $r->user,
                'created_at' => $r->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
                'from' => $rows->firstItem(),
                'to' => $rows->lastItem(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Incident $incident, ?int $viewerId): array
    {
        $count = MeTooReport::query()
            ->where('incident_id', $incident->id)
            ->count();

        $hasMeToo = $viewerId !== null && MeTooReport::query()
            ->where('incident_id', $incident->id)
            ->where('user_id', $viewerId)
            ->exists();

        return [
            'incident_id' => (int) $incident->id,
            'me_too_count' => (int) $count,
            'viewer_has_me_too' => $hasMeToo,
        ];
    }

    private function bumpRedisCount(int $incidentId, int $delta): void
    {
        try {
            DB::afterCommit(function () use ($incidentId, $delta): void {
                try {
                    \Illuminate\Support\Facades\Redis::hincrby(
                        sprintf(self::REDIS_HASH_KEY, $incidentId),
                        'me_too_count',
                        $delta,
                    );
                    \App\Domains\Incidents\Jobs\SyncIncidentToRedisJob::dispatch($incidentId);
                } catch (\Throwable $e) {
                    Log::warning('me_too.redis_increment_failed', [
                        'incident_id' => $incidentId,
                        'delta' => $delta,
                        'error' => $e->getMessage(),
                    ]);
                }
            });
        } catch (\Throwable $e) {
            Log::warning('me_too.after_commit_failed', [
                'incident_id' => $incidentId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
