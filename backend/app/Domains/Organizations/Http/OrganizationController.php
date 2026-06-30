<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Http;

use App\Domains\Organizations\Http\Requests\StoreOrganizationRequest;
use App\Domains\Organizations\Http\Requests\UpdateOrganizationRequest;
use App\Domains\Organizations\Http\Resources\OrganizationCollection;
use App\Domains\Organizations\Http\Resources\OrganizationResource;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Organizations\Repositories\OrganizationRepository;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;

class OrganizationController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private readonly OrganizationRepository $organizations)
    {
        $this->authorizeResource(Organization::class, 'organization');
    }

    public function tree(): JsonResponse
    {
        $tree = $this->organizations->tree();

        return response()->json(['data' => OrganizationResource::collection($tree)]);
    }

    public function index(Request $request): JsonResponse
    {
        $organizations = $this->organizations->paginate(
            $request->only(['search', 'location_id', 'per_page']),
        );

        return (new OrganizationCollection($organizations))->response();
    }

    public function store(StoreOrganizationRequest $request): JsonResponse
    {
        $organization = $this->organizations->create(
            $request->validated(),
        );
        $organization->load(['category', 'location', 'parent']);

        return (new OrganizationResource($organization))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Organization $organization): JsonResponse
    {
        $organization->load(['category', 'location', 'parent']);
        return (new OrganizationResource($organization))->response();
    }

    public function update(UpdateOrganizationRequest $request, Organization $organization): JsonResponse
    {
        $organization = $this->organizations->update($organization->id, $request->validated());
        $organization->load(['category', 'location', 'parent']);

        return (new OrganizationResource($organization))->response();
    }

    public function destroy(Organization $organization): JsonResponse
    {
        $this->organizations->delete($organization->id);

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
