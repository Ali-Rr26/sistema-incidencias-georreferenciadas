<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Resources;

use App\Domains\Locations\Http\Resources\LocationResource;
use App\Domains\Locations\Repositories\LocationRepository;
use App\Storage\StorageService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

class IncidentResource extends JsonResource
{
    /**
     * When true, embeds status_history and assignments in the response.
     * Enabled only by show() — list/store/update are unaffected.
     */
    public bool $withDetail = false;

    public function withDetail(bool $value = true): static
    {
        $this->withDetail = $value;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $storage = app(StorageService::class);
        $images = $this->images ?? [];
        $thumbnail = ! empty($images) ? $images[0] : null;

        $data = [
            'id' => $this->id,
            'incident_category_id' => $this->incident_category_id,
            'organization_id' => $this->organization_id,
            'user_id' => $this->user_id,
            'location_id' => $this->location_id,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status?->value,
            'priority' => $this->priority?->value,
            'resolution_date' => $this->resolution_date,
            'geom' => $this->when($this->geom !== null, fn () => json_decode($this->geom->toJson())),
            'created_at' => $this->created_at,
            'claimed_by' => $this->claimed_by,
            'claimed_at' => $this->claimed_at,
            'category' => $this->whenLoaded('category'),
            'organization' => $this->whenLoaded('organization'),
            'user' => $this->whenLoaded('user'),
            // Use LocationResource to ensure geom is always serialized (null when absent)
            'location' => $this->whenLoaded('location', fn () => new LocationResource($this->location)),
            'thumbnail_url' => $thumbnail
                ? $storage->proxyUrl($thumbnail['path'])
                : null,
            'images' => array_map(fn (array $img) => [
                'id' => $this->id.'-'.md5($img['path']),
                'url' => $storage->proxyUrl($img['path']),
                'original_name' => $img['original_name'],
                'is_thumbnail' => $img['is_thumbnail'] ?? false,
            ], $images),
        ];

        // Add location_path for progressive-loading preselection cascade
        // Uses ancestors() to get root-to-leaf ordered chain for deterministic select preselection
        if ($this->location_id !== null) {
            $locationRepo = app(LocationRepository::class);
            $ancestors = $locationRepo->ancestors($this->location_id);
            $data['location_path'] = $ancestors->map(fn ($location) => [
                'id' => $location->id,
                'name' => $location->name,
                'level' => $location->level->value,
                'geom' => $location->geom !== null ? json_decode($location->geom->toJson()) : null,
            ])->values()->all();
        }

        if ($this->withDetail) {
            // Status history — read via raw query (same as StatusHistoryController)
            // to avoid creating an Eloquent model just for a simple log table.
            $data['status_history'] = DB::table('status_history')
                ->where('incident_id', $this->id)
                ->orderBy('created_at')
                ->orderBy('id')
                ->get(['id', 'user_id', 'previous_status', 'new_status', 'created_at'])
                ->map(fn ($r) => [
                    'id' => (int) $r->id,
                    'user_id' => (int) $r->user_id,
                    'previous_status' => $r->previous_status,
                    'new_status' => $r->new_status,
                    'created_at' => $r->created_at,
                ])
                ->all();

            // Current assignments — eager-load user to match AssignmentResource shape.
            $data['assignments'] = $this->whenLoaded(
                'assignments',
                fn () => $this->assignments->map(fn ($a) => [
                    'id' => $a->id,
                    'incident_id' => $a->incident_id,
                    'user_id' => $a->user_id,
                    'role' => $a->assignment_role,
                    'created_at' => $a->created_at,
                    'updated_at' => $a->updated_at,
                    'user' => $a->relationLoaded('user') ? $a->user : null,
                ])->values()->all(),
            );
        }

        return $data;
    }
}
