<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http;

use App\Domains\Incidents\Http\Resources\IncidentCollection;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class FeedController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $perPage = min((int) $request->get('per_page', 12), 50);

        $incidents = Incident::with(['category.organization', 'location'])
            ->when($request->get('organization_id'), fn ($q, $v) => $q->where('organization_id', $v))
            ->when($request->get('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->get('location_id'), function ($q, $v) {
                $location = Location::find((int) $v);
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
