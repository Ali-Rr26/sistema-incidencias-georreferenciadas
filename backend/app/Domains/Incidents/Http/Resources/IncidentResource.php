<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncidentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
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
            'category' => $this->whenLoaded('category'),
            'organization' => $this->whenLoaded('organization'),
            'user' => $this->whenLoaded('user'),
            'location' => $this->whenLoaded('location'),
        ];
    }
}
