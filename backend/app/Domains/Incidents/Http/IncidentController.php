<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http;

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Http\Requests\StoreIncidentRequest;
use App\Domains\Incidents\Http\Requests\UpdateIncidentRequest;
use App\Domains\Incidents\Http\Resources\IncidentCollection;
use App\Domains\Incidents\Http\Resources\IncidentResource;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Repositories\IncidentRepository;
use App\Domains\Incidents\Services\IncidentClaimService;
use App\Domains\Incidents\Services\IncidentVerificationService;
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

    public function index(Request $request): JsonResponse
    {
        $incidents = $this->incidents->paginate(
            $request->only(['status', 'priority', 'location_id', 'incident_category_id', 'user_id', 'title', 'per_page']),
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

        // Convertir GeoJSON string a Point object para el cast espacial
        if (isset($data['geom']) && is_string($data['geom'])) {
            $geom = json_decode($data['geom'], true);
            if (isset($geom['coordinates'])) {
                $data['geom'] = new Point($geom['coordinates'][1], $geom['coordinates'][0]);
            }
        }

        // Los archivos se manejan aparte — no mezclar con el create
        unset($data['images']);

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
        $incident = $this->incidents->findById($id);

        $data = $request->validated();

        // Convertir GeoJSON string a Point object para el cast espacial
        if (isset($data['geom']) && is_string($data['geom'])) {
            $geom = json_decode($data['geom'], true);
            if (isset($geom['coordinates'])) {
                $data['geom'] = new Point($geom['coordinates'][1], $geom['coordinates'][0]);
            }
        }

        unset($data['images']);

        if ($request->hasFile('images')) {
            $hasExisting = ! empty($incident->images);
            $images = $this->uploadImages($request->file('images'), $incident->id, ! $hasExisting);
            $existing = $incident->images ?? [];
            $data['images'] = array_merge($existing, $images);
        }

        $incident = $this->incidents->update($id, $data);

        return (new IncidentResource($incident))->response();
    }

    public function destroy(int $id): JsonResponse
    {
        $this->incidents->delete($id);

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Multitenant: Claim / Release / Confirmar
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Toma (claim) una incidencia como OperadorOrg.
     */
    public function claim(Incident $incident, IncidentClaimService $service): JsonResponse
    {
        /** @var \App\Domains\Users\Models\User $user */
        $user = auth()->user();
        $incident = $service->claim($incident->id, $user);

        return (new IncidentResource($incident))->response();
    }

    /**
     * Libera (release) una incidencia previamente claimeada.
     */
    public function release(Incident $incident, IncidentClaimService $service): JsonResponse
    {
        /** @var \App\Domains\Users\Models\User $user */
        $user = auth()->user();
        $incident = $service->release($incident->id, $user);

        return (new IncidentResource($incident))->response();
    }

    /**
     * Confirma una incidencia como Publicador y la asigna a su org.
     */
    public function confirmar(Incident $incident, IncidentVerificationService $service): JsonResponse
    {
        /** @var \App\Domains\Users\Models\User $user */
        $user = auth()->user();
        $incident = $service->confirm($incident->id, $user);

        return (new IncidentResource($incident))->response();
    }

    /**
     * Lista incidencias pendientes de confirmación para el Publicador.
     */
    public function pendientes(IncidentVerificationService $service): JsonResponse
    {
        /** @var \App\Domains\Users\Models\User $user */
        $user = auth()->user();
        $incidents = $service->getPendingIncidents($user);

        return (new IncidentCollection($incidents))->response();
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
