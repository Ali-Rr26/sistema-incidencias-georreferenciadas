<?php

declare(strict_types=1);

namespace App\Domains\Users\Http;

use App\Domains\Roles\Enums\UserRole;
use App\Domains\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Redis;

class OperatorLocationController extends Controller
{
    /**
     * Role-id → UserRole enum-case mapping (verified against RoleSeeder).
     *
     * The roles table stores int role_id and a string `name` column. The
     * `name` column holds the UserRole enum string value. This controller
     * is now driven entirely by the enum value (`role->name`), NEVER by
     * the integer role_id.
     *
     * | role_id (DB) | UserRole enum case      | enum ->value        |
     * |-------------:|-------------------------|---------------------|
     * |            1 | AdminSistema            | admin_sistema       |
     * |            2 | OperadorSistema         | operador_sistema    |
     * |            3 | AdminOrganizacion       | admin_organizacion  |
     * |            4 | OperadorOrganizacion    | operador_organizacion|
     * |            5 | Usuario                 | usuario             |
     * |            6 | Publicador              | publicador          |
     *
     * Acceptance (SCEN-3.2): grep -rn '\[2, *3, *4\]' app/Domains/Users/Http/
     * must return zero matches in this file.
     */
    private const ACTIVE_KEY = 'operators:active';

    private const LOCATIONS_KEY = 'operators:locations';

    private const TTL_SECONDS = 300;

    /**
     * Roles allowed to PING their own location (update endpoint).
     *
     * Composed of:
     *  - UserRole::OperadorSistema
     *  - UserRole::OperadorOrganizacion
     *
     * SystemAdmin is allowed via the $user->isSystemAdmin() short-circuit,
     * and is intentionally NOT listed here so the same role-id set is
     * the single source of truth for non-admin tiers.
     */
    private const PING_ROLES = [
        UserRole::OperadorSistema->value,
        UserRole::OperadorOrganizacion->value,
    ];

    /**
     * Roles allowed to QUERY the operator-locations map (index endpoint).
     *
     * Includes the union of operator + admin-of-org tiers; SystemAdmin
     * is again handled by $user->isSystemAdmin() and not enumerated.
     */
    private const QUERY_ROLES = [
        UserRole::OperadorSistema->value,
        UserRole::AdminOrganizacion->value,
        UserRole::OperadorOrganizacion->value,
    ];

    /**
     * Update the logged-in operator's location in Redis.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        // Solo admins de sistema, operadores de sistema u operadores de org pueden reportar ubicación
        if (! $user->isSystemAdmin() && ! in_array($user->role?->name, self::PING_ROLES, true)) {
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

        // Admins de sistema, operadores de sistema, admins de org u operadores de org
        if (! $currentUser->isSystemAdmin() && ! in_array($currentUser->role?->name, self::QUERY_ROLES, true)) {
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

        // Query active users with role "operador_organizacion"
        $query = User::query()
            ->whereIn('id', $activeIds)
            ->whereHas('role', fn ($q) => $q->where('name', UserRole::OperadorOrganizacion->value));

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
