<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Repositories;

use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Shared\Repositories\EloquentRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

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

        return $this->newQuery()
            ->with('location', 'parent', 'category')
            ->when(count($filters) > 0, fn (Builder $q) => $this->applyFilters($q, $filters))
            ->paginate(min($perPage, 100));
    }

    public function findById(int $id): ?Organization
    {
        return $this->newQuery()->with('category')->find($id);
    }

    public function tree(): Collection
    {
        return $this->newQuery()
            ->whereNull('parent_id')
            ->with('location', 'category', 'children.children.children')
            ->get();
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
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
