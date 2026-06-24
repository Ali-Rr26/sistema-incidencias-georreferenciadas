<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http;

use App\Domains\Incidents\Http\Requests\StoreIncidentRequest;
use App\Domains\Incidents\Http\Requests\UpdateIncidentRequest;
use App\Domains\Incidents\Http\Resources\IncidentCollection;
use App\Domains\Incidents\Http\Resources\IncidentResource;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Repositories\IncidentRepository;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;

class IncidentController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly IncidentRepository $incidents)
    {
        $this->authorizeResource(Incident::class, 'incident');
    }

    public function index(Request $request): JsonResponse
    {
        $incidents = $this->incidents->paginate(
            $request->only(['status', 'priority', 'location_id', 'incident_category_id', 'user_id', 'per_page']),
        );

        return (new IncidentCollection($incidents))->response();
    }

    public function store(StoreIncidentRequest $request): JsonResponse
    {
        $data = array_merge($request->validated(), [
            'user_id' => $request->user()->id,
        ]);

        $incident = $this->incidents->create($data);

        return (new IncidentResource($incident))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(int $id): JsonResponse
    {
        $incident = $this->incidents->findById($id);

        if ($incident === null) {
            return response()->json(['message' => 'Incident not found'], Response::HTTP_NOT_FOUND);
        }

        return (new IncidentResource($incident))->response();
    }

    public function update(UpdateIncidentRequest $request, int $id): JsonResponse
    {
        $incident = $this->incidents->update($id, $request->validated());

        return (new IncidentResource($incident))->response();
    }

    public function destroy(int $id): JsonResponse
    {
        $this->incidents->delete($id);

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
