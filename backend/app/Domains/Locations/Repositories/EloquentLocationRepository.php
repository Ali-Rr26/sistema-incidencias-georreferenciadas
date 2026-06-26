<?php

declare(strict_types=1);

namespace App\Domains\Locations\Repositories;

use App\Domains\Locations\Models\Location;
use App\Domains\Shared\Repositories\EloquentRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use MatanYadaev\EloquentSpatial\Objects\Point;

class EloquentLocationRepository extends EloquentRepository implements LocationRepository
{
    public function __construct()
    {
        parent::__construct(new Location);
    }

    public function findByLevel(string $level): Collection
    {
        return $this->newQuery()->where('level', $level)->get();
    }

    public function findByParent(int $parentId): Collection
    {
        return $this->newQuery()->where('parent_id', $parentId)->get();
    }

    public function findByPoint(Point $point): ?Location
    {
        return $this->newQuery()
            ->whereContains('geom', $point)
            ->first();
    }

    public function tree(): Collection
    {
        return $this->newQuery()
            ->whereNull('parent_id')
            ->with('children.children.children')
            ->get();
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
        $query
            ->when($filters['search'] ?? null, fn (Builder $query, string $value) => $query->where(function (Builder $query) use ($value) {
                $query->where('name', 'LIKE', "%{$value}%")
                    ->orWhere('code', 'LIKE', "%{$value}%");
            }))
            ->when($filters['level'] ?? null, fn (Builder $query, string $value) => $query->where('level', $value))
            ->when($filters['parent_id'] ?? null, fn (Builder $query, string $value) => $query->where('parent_id', $value));
    }
}
