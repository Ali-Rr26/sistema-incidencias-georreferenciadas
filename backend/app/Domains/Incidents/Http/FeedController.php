<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http;

use App\Domains\Incidents\Models\FeedService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

/**
 * Read-side of the CQRS split for the incidents feed.
 *
 * Writes go through `IncidentController` (Postgres + Redis-incident-sync
 * listener), reads come from the precomputed Redis "feed" indexes via
 * `FeedService`. The controller is intentionally thin: parameter shaping
 * + delegate. Any decision about whether to fall back to Postgres lives
 * inside FeedService, not duplicated here.
 */
class FeedController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $result = app(FeedService::class)->getFeed(
            status: $request->get('status'),
            organizationId: $request->filled('organization_id') ? (int) $request->integer('organization_id') : null,
            locationId: $request->filled('location_id') ? (int) $request->integer('location_id') : null,
            page: max(1, (int) $request->integer('page', 1)),
            perPage: min(max(1, (int) $request->integer('per_page', 12)), 50),
        );

        return response()->json($result);
    }
}
