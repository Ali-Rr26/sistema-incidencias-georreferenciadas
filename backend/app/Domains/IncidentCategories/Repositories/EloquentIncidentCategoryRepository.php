<?php

declare(strict_types=1);

namespace App\Domains\IncidentCategories\Repositories;

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Shared\Repositories\EloquentRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class EloquentIncidentCategoryRepository extends EloquentRepository implements IncidentCategoryRepository
{
    public function __construct()
    {
        parent::__construct(new IncidentCategory());
    }

    public function findByOrganization(int $organizationId): Collection
    {
        return $this->newQuery()->where('organization_id', $organizationId)->get();
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
        $query
            ->when($filters['search'] ?? null, fn (Builder $q, string $v) => $q->where('name', 'LIKE', "%{$v}%"))
            ->when($filters['organization_id'] ?? null, fn (Builder $q, string $v) => $q->where('organization_id', $v))
            ->when($filters['parent_id'] ?? null, fn (Builder $q, string $v) => $q->where('parent_id', $v));
    }
}
