<?php

declare(strict_types=1);

namespace App\Domains\IncidentCategories\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncidentCategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'name'            => $this->name,
            'organization_id' => $this->organization_id,
            'parent_id'       => $this->parent_id,
            'organization'    => $this->whenLoaded('organization'),
            'parent'          => new self($this->whenLoaded('parent')),
            'children'        => self::collection($this->whenLoaded('children')),
        ];
    }
}
