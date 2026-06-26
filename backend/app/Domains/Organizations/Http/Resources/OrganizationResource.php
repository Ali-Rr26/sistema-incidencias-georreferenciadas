<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Http\Resources;

use App\Domains\IncidentCategories\Http\Resources\IncidentCategoryResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrganizationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'name'              => $this->name,
            'location_id'       => $this->location_id,
            'location'          => $this->whenLoaded('location'),
            'parent_id'         => $this->parent_id,
            'parent'            => $this->whenLoaded('parent'),
            'children'          => OrganizationResource::collection($this->whenLoaded('children')),
            'incident_categories' => IncidentCategoryResource::collection($this->whenLoaded('incidentCategories')),
            'created_at'        => $this->created_at,
            'updated_at'        => $this->updated_at,
        ];
    }
}
