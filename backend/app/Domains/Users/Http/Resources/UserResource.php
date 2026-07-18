<?php

declare(strict_types=1);

namespace App\Domains\Users\Http\Resources;

use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * When true, embeds roles and organizations catalogs in the response.
     * Enabled only by show() so edit-mode forms need a single GET /users/:id.
     */
    public bool $withCatalog = false;

    public function withCatalog(bool $value = true): static
    {
        $this->withCatalog = $value;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'email' => $this->email,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'phone' => $this->phone,
            'avatar' => $this->avatar,
            'profile_image_path' => $this->profile_image_path,
            'role' => $this->whenLoaded('role', fn () => [
                'id' => $this->role->id,
                'name' => $this->role->name,
            ]),
            'organization' => $this->whenLoaded('organization', fn () => [
                'id' => $this->organization->id,
                'name' => $this->organization->name,
            ]),
        ];

        if ($this->withCatalog) {
            $data['roles'] = Role::orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Role $r) => ['id' => $r->id, 'name' => $r->name])
                ->values();

            $data['organizations'] = Organization::orderBy('name')
                ->get(['id', 'name'])
                ->map(fn (Organization $o) => ['id' => $o->id, 'name' => $o->name])
                ->values();
        }

        return $data;
    }
}
