<?php

declare(strict_types=1);

namespace App\Domains\IncidentCategories\Http\Resources;

use App\Domains\Organizations\Http\Resources\OrganizationResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncidentCategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'name'            => $this->name,
            'parent_id'       => $this->parent_id,
            'organizations'   => OrganizationResource::collection($this->whenLoaded('organizations')),
            'parent'          => new self($this->whenLoaded('parent')),
            'children'        => self::collection($this->whenLoaded('children')),
        ];
    }
}
