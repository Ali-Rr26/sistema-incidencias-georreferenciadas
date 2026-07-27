<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Controllers;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentFollower;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

/**
 * HTTP shell for the "Seguir" (follow) sub-resource.
 *
 *   POST   /api/incidents/{incident}/follow        — auth, idempotent
 *   DELETE /api/incidents/{incident}/follow        — auth, idempotent
 *   GET    /api/incidents/{incident}/follow        — public (count + is_following)
 *
 * Same shape as {@see MeTooController} but the Redis counter is
 * `followers_count` (the field surfaced by the feed serializer).
 *
 * The follow-action itself does NOT trigger notifications — those happen
 * when a Comment is posted on a followed incident (covered in
 * CommentNotificationObserver) or when the incident's status changes
 * (covered in IncidentNotificationObserver / status_history trigger).
 */
class IncidentFollowerController extends Controller
{
    public function store(Request $request, Incident $incident): JsonResponse
    {
        $user = $request->user();

        if ($user === null) {
            abort(401);
        }

        $follower = IncidentFollower::firstOrCreate(
            [
                'incident_id' => $incident->id,
                'user_id' => $user->id,
            ],
            [
                'created_at' => now(),
            ],
        );

        if ($follower->wasRecentlyCreated) {
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

        $deleted = IncidentFollower::query()
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

    /**
     * @return array<string, mixed>
     */
    private function payload(Incident $incident, ?int $viewerId): array
    {
        $count = IncidentFollower::query()
            ->where('incident_id', $incident->id)
            ->count();

        $isFollowing = $viewerId !== null && IncidentFollower::query()
            ->where('incident_id', $incident->id)
            ->where('user_id', $viewerId)
            ->exists();

        return [
            'incident_id' => (int) $incident->id,
            'followers_count' => (int) $count,
            'is_following' => $isFollowing,
        ];
    }

    private function bumpRedisCount(int $incidentId, int $delta): void
    {
        try {
            DB::afterCommit(function () use ($incidentId, $delta): void {
                try {
                    Redis::hincrby(
                        sprintf('incident:%d', $incidentId),
                        'followers_count',
                        $delta,
                    );
                    \App\Domains\Incidents\Jobs\SyncIncidentToRedisJob::dispatch($incidentId);
                } catch (\Throwable $e) {
                    Log::warning('followers.redis_increment_failed', [
                        'incident_id' => $incidentId,
                        'delta' => $delta,
                        'error' => $e->getMessage(),
                    ]);
                }
            });
        } catch (\Throwable $e) {
            Log::warning('followers.after_commit_failed', [
                'incident_id' => $incidentId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
