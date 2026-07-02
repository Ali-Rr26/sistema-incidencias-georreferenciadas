<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http;

use App\Domains\Incidents\Http\Resources\IncidentCollection;
use App\Domains\Incidents\Models\FeedService;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Log;

class FeedController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', 12), 50);
        $page = (int) $request->integer('page', 1);

        try {
            $result = app(FeedService::class)->getFeed(
                status: $request->get('status'),
                organizationId: $request->filled('organization_id') ? (int) $request->integer('organization_id') : null,
                locationId: $request->filled('location_id') ? (int) $request->integer('location_id') : null,
                page: $page,
                perPage: $perPage,
            );

            return response()->json($result);
        } catch (\Throwable $e) {
            Log::warning('Redis feed failed, falling back to PostgreSQL', [
                'error' => $e->getMessage(),
            ]);
        }

        // PostgreSQL fallback path
        $incidents = Incident::with(['category', 'location', 'user'])
            ->when($request->filled('organization_id'), fn ($q) => $q->where('organization_id', $request->integer('organization_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->get('status')))
            ->when($request->filled('location_id'), function ($q) use ($request) {
                $location = Location::find($request->integer('location_id'));
                if ($location) {
                    $ids = $location->descendantsAndSelf()->pluck('id');
                    $q->whereIn('location_id', $ids);
                }
            })
            ->latest()
            ->paginate($perPage);

        return (new IncidentCollection($incidents))->response();
    }
}
