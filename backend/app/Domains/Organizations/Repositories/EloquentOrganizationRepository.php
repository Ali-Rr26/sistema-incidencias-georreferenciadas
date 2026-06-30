<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Repositories;

use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Shared\Repositories\EloquentRepository;
use App\Domains\Users\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;

class EloquentOrganizationRepository extends EloquentRepository implements OrganizationRepository
{
    public function __construct()
    {
        parent::__construct(new Organization);
    }

    public function paginate(array $filters = [], int $perPage = 20): LengthAwarePaginator
    {
        $perPage = isset($filters['per_page']) ? (int) $filters['per_page'] : $perPage;
        unset($filters['per_page']);

        $query = $this->newQuery()
            ->with('location', 'parent', 'category');

        $this->applyFilters($query, $filters);

        return $query->paginate(min($perPage, 100));
    }

    public function findById(int $id): ?Organization
    {
        return $this->newQuery()->with('category')->find($id);
    }

    public function tree(): Collection
    {
        $query = $this->newQuery();

        /** @var User|null $user */
        $user = Auth::user();
        if ($user !== null && ! $user->isSystemAdmin()) {
            if ($user->isOrganizationMember()) {
                $query->where('id', $user->organization_id);
            } else {
                $query->whereRaw('1 = 0');
            }
        } else {
            $query->whereNull('parent_id');
        }

        return $query
            ->with('location', 'category', 'children.children.children')
            ->get();
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
        // Scoping por organización (Multitenancy)
        /** @var User|null $user */
        $user = Auth::user();
        if ($user !== null && ! $user->isSystemAdmin()) {
            if ($user->isOrganizationMember()) {
                $query->where('id', $user->organization_id);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        $query
            ->when($filters['search'] ?? null, fn (Builder $q, string $v) => $q->where('name', 'LIKE', "%{$v}%"))
            ->when($filters['location_id'] ?? null, function (Builder $q, string $v) {
                $location = Location::find((int) $v);
                if ($location) {
                    $ids = $location->descendantsAndSelf()->pluck('id');
                    $q->whereIn('location_id', $ids);
                }
            });
    }
}
