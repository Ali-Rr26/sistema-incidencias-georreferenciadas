<?php

declare(strict_types=1);

namespace App\Domains\Users\Http;

use App\Domains\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Redis;

class OperatorLocationController extends Controller
{
    private const ACTIVE_KEY = 'operators:active';

    private const LOCATIONS_KEY = 'operators:locations';

    private const TTL_SECONDS = 300;

    /**
     * Update the logged-in operator's location in Redis.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        // Enforce that only operators and system roles can ping location
        if (! in_array($user->role_id, [1, 2, 4])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $data = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $userId = (string) $user->id;

        // Store location (longitude first, then latitude in Redis GEOADD)
        Redis::geoadd(self::LOCATIONS_KEY, (float) $data['lng'], (float) $data['lat'], $userId);

        // Store active timestamp in sorted set
        Redis::zadd(self::ACTIVE_KEY, (float) time(), $userId);

        return response()->json(['status' => 'success']);
    }

    /**
     * Get active operator locations within the tenant/org boundaries.
     */
    public function index(Request $request): JsonResponse
    {
        $currentUser = $request->user();

        // Enforce allowed roles (AdminSistema, OperadorSistema, AdminOrganizacion, OperadorOrganizacion)
        if (! in_array($currentUser->role_id, [1, 2, 3, 4])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $now = time();
        $staleLimit = $now - self::TTL_SECONDS;

        // Clean up stale operators older than 300 seconds
        $staleIds = Redis::zrangebyscore(self::ACTIVE_KEY, '-inf', (string) $staleLimit);
        if (! empty($staleIds)) {
            Redis::zrem(self::LOCATIONS_KEY, ...$staleIds);
            Redis::zremrangebyscore(self::ACTIVE_KEY, '-inf', (string) $staleLimit);
        }

        // Get all active operator IDs
        $activeIds = Redis::zrange(self::ACTIVE_KEY, 0, -1);

        if (empty($activeIds)) {
            return response()->json([]);
        }

        // Query active users with role "operador_organizacion" (ID 4)
        $query = User::query()
            ->whereIn('id', $activeIds)
            ->where('role_id', 4);

        // If organization-scoped, filter by current user's organization
        if ($currentUser->organization_id !== null) {
            $query->where('organization_id', $currentUser->organization_id);
        }

        $users = $query->get();
        $result = [];

        if ($users->isNotEmpty()) {
            $pipe = Redis::pipeline();
            foreach ($users as $user) {
                $pipe->zscore(self::ACTIVE_KEY, (string) $user->id);
                $pipe->geopos(self::LOCATIONS_KEY, (string) $user->id);
            }
            $redisData = $pipe->exec();

            foreach ($users as $index => $user) {
                $ping = $redisData[$index * 2] ?? null;
                $pos = $redisData[$index * 2 + 1] ?? null;

                $lat = null;
                $lng = null;
                if (! empty($pos) && isset($pos[0])) {
                    $lng = (float) $pos[0][0];
                    $lat = (float) $pos[0][1];
                }

                $result[] = [
                    'id' => $user->id,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'organization_id' => $user->organization_id,
                    'lat' => $lat,
                    'lng' => $lng,
                    'last_ping' => $ping ? (int) $ping : null,
                ];
            }
        }

        return response()->json($result);
    }
}
