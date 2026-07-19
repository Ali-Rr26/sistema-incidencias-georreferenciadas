<?php

declare(strict_types=1);

namespace App\Domains\Roles\Repositories;

use App\Domains\Roles\Models\Role;
use App\Domains\Shared\Repositories\EloquentRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class EloquentRoleRepository extends EloquentRepository implements RoleRepository
{
    public function __construct()
    {
        parent::__construct(new Role);
    }

    public function applyFilters(Builder $query, array $filters): void
    {
        $query->when(
            $filters['search'] ?? null,
            fn (Builder $query, string $value) => $query->where('name', 'LIKE', "%{$value}%")
        );
    }

    public function catalog(): Collection
    {
        return $this->newQuery()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Role $r) => ['id' => $r->id, 'name' => $r->name])
            ->values();
    }

    public function syncPermissions(int $roleId, array $permissionIds): Model
    {
        $role = $this->findById($roleId);

        if ($role === null) {
            throw new \RuntimeException("Role with ID {$roleId} not found.", 404);
        }

        $role->permissions()->sync($permissionIds);

        return $role;
    }
}
