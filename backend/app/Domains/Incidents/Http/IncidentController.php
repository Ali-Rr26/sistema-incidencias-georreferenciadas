<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http;

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Http\Requests\StoreIncidentRequest;
use App\Domains\Incidents\Http\Requests\UpdateIncidentRequest;
use App\Domains\Incidents\Http\Requests\UpdateIncidentStatusRequest;
use App\Domains\Incidents\Http\Resources\IncidentCollection;
use App\Domains\Incidents\Http\Resources\IncidentResource;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Repositories\IncidentRepository;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Users\Models\User;
use App\Storage\StorageService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Controller;
use MatanYadaev\EloquentSpatial\Objects\Point;

class IncidentController extends Controller
{
    use AuthorizesRequests;

    public function __construct(
        private readonly IncidentRepository $incidents,
        private readonly StorageService $storage,
    ) {
        $this->authorizeResource(Incident::class, 'incident');
    }

    /**
     * Relations eagerly loaded for the list endpoint.
     *
     * Mirrors the fields exposed via `IncidentResource::toArray()` for the
     * list shape (`category`, `organization`, `user`, `location`). `comments`
     * is intentionally NOT a relation here — only the count is exposed via
     * `withCount('comments')` (kept in the repository).
     */
    private const INDEX_RELATIONS = ['category', 'organization', 'user', 'location'];

    public function index(Request $request): JsonResponse
    {
        // Inline map params validation (was MapBoundsRequest FormRequest).
        // One place to read; three fields actually filter the list.
        $validated = $request->validate([
            'bbox' => [
                'nullable',
                'string',
                'regex:/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/',
            ],
            'zoom' => ['nullable', 'integer', 'min:1', 'max:22'],
            'status' => ['nullable', 'string'],
            'priority' => ['nullable', 'string'],
            'location_id' => ['nullable', 'integer'],
            'incident_category_id' => ['nullable', 'integer'],
            'user_id' => ['nullable', 'integer'],
            'title' => ['nullable', 'string', 'max:200'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:500'],
            'relations' => ['nullable', 'array'],
            'relations.*' => ['string'],
        ]) + ['relations' => self::INDEX_RELATIONS];

        // The map frontend asks for 500 per page because a single bbox
        // viewport can legitimately hold >100 incidents in dense urban
        // areas. The default repo cap (100) is too tight here, so we
        // raise it only when a bbox is present. Other callers keep the
        // safe 100 cap.
        $hardCap = isset($validated['bbox']) ? 500 : null;

        $incidents = $this->incidents->paginate(
            $validated,
            perPage: 20,
            hardCap: $hardCap,
        );

        return (new IncidentCollection($incidents))->response();
    }

    public function store(StoreIncidentRequest $request): JsonResponse
    {
        $validated = $request->validated();
        IncidentCategory::findOrFail($validated['incident_category_id']);

        $data = array_merge($validated, [
            'user_id' => $request->user()->id,
        ]);

        $data = $this->castGeomToPoint($data);

        // Los archivos se manejan aparte — no mezclar con el create
        unset($data['images']);

        // Auto-asignar organización basada en la ubicación (B-02)
        // Si no se envió organization_id explícitamente, buscar una
        // organización cuyo location_id coincida con la ubicación de la
        // incidencia o con alguno de sus ancestros en la jerarquía.
        if (empty($data['organization_id']) && ! empty($data['location_id'])) {
            $location = Location::find($data['location_id']);
            if ($location !== null) {
                $locationIds = $location->ancestorsAndSelf()->pluck('id');
                $org = Organization::whereIn('location_id', $locationIds)->first();
                if ($org !== null) {
                    $data['organization_id'] = $org->id;
                }
            }
        }

        $incident = $this->incidents->create($data);

        if ($request->hasFile('images')) {
            $images = $this->uploadImages($request->file('images'), $incident->id, true);
            if (! empty($images)) {
                $incident->update(['images' => $images]);
            }
        }

        return (new IncidentResource($incident))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Relations eagerly loaded for the show endpoint.
     * `assignments.user` is included here (not in INDEX_RELATIONS) because
     * the detail view embeds assignments directly — the list endpoint does
     * not need them.
     */
    private const SHOW_RELATIONS = ['category', 'organization', 'user', 'location', 'assignments.user'];

    public function show(Request $request, Incident $incident): JsonResponse
    {
        $incident->load(self::SHOW_RELATIONS);

        return (new IncidentResource($incident))->withDetail()->response();
    }

    public function update(UpdateIncidentRequest $request, Incident $incident): JsonResponse
    {
        $data = $this->castGeomToPoint($request->validated());

        unset($data['images']);

        if ($request->hasFile('images')) {
            $hasExisting = ! empty($incident->images);
            $images = $this->uploadImages($request->file('images'), $incident->id, ! $hasExisting);
            $existing = $incident->images ?? [];
            $data['images'] = array_merge($existing, $images);
        }

        $incident = $this->incidents->update($incident->id, $data);

        return (new IncidentResource($incident))->response();
    }

    public function destroy(Incident $incident): JsonResponse
    {
        $this->incidents->delete($incident->id);

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    public function updateStatus(UpdateIncidentStatusRequest $request, Incident $incident): JsonResponse
    {
        $validated = $request->validated();

        // Permiso de update + regla de responsable, ambos en la Policy.
        $this->authorize('updateStatus', [$incident, $validated['status']]);

        $incident = $this->incidents->update($incident->id, ['status' => $validated['status']]);

        return (new IncidentResource($incident))->response();
    }

    /**
     * Los FormRequests validan `geom` como string GeoJSON; el cast espacial
     * del modelo necesita un objeto Point. Compartido por store() y update().
     */
    private function castGeomToPoint(array $data): array
    {
        if (isset($data['geom']) && is_string($data['geom'])) {
            $geom = json_decode($data['geom'], true);
            if (isset($geom['coordinates'])) {
                $data['geom'] = new Point($geom['coordinates'][1], $geom['coordinates'][0]);
            }
        }

        return $data;
    }

    /**
     * Returns the list of operators (role = operador_organizacion) that
     * belong to the same organization as the incident.
     *
     * Replaces the two-request dance the frontend used to do:
     *   GET /roles?per_page=100  → find operador_organizacion role id
     *   GET /users?organization_id=X&role_id=Y → get operator list
     *
     * Authorization reuses the parent incident's view policy — if you can
     * see the incident you can see who could be assigned to it.
     */
    public function availableOperators(Request $request, Incident $incident): JsonResponse
    {
        $this->authorize('view', $incident);

        if ($incident->organization_id === null) {
            return response()->json(['data' => []]);
        }

        $operators = User::query()
            ->whereHas('role', fn ($q) => $q->where('name', UserRole::OperadorOrganizacion->value))
            ->where('organization_id', $incident->organization_id)
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get(['id', 'first_name', 'last_name', 'email']);

        return response()->json([
            'data' => $operators->map(fn (User $u) => [
                'id' => $u->id,
                'first_name' => $u->first_name,
                'last_name' => $u->last_name,
                'email' => $u->email,
            ])->values(),
        ]);
    }

    /**
     * Sube archivos a S3 y retorna array de metadata.
     *
     * @param  UploadedFile[]|UploadedFile|null  $files
     * @param  bool  $firstIsThumbnail  Si el primer archivo debe marcarse como thumbnail
     * @return array<int, array{path: string, original_name: string, mime_type: string, size: int, is_thumbnail: bool}>
     */
    private function uploadImages(array|UploadedFile|null $files, int $incidentId, bool $firstIsThumbnail): array
    {
        $files = is_array($files) ? $files : ($files ? [$files] : []);
        $files = array_filter($files);

        if (empty($files)) {
            return [];
        }

        $images = [];

        foreach ($files as $i => $file) {
            $key = $this->storage->uploadImage($file, $incidentId);

            $images[] = [
                'path' => $key,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'is_thumbnail' => $firstIsThumbnail && $i === 0,
            ];
        }

        return $images;
    }
}
