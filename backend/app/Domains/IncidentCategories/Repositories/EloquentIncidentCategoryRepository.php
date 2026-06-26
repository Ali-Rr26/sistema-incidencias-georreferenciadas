<?php

declare(strict_types=1);

namespace App\Domains\IncidentCategories\Repositories;

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Shared\Repositories\EloquentRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class EloquentIncidentCategoryRepository extends EloquentRepository implements IncidentCategoryRepository
{
    public function __construct()
    {
        parent::__construct(new IncidentCategory);
    }

    public function paginate(array $filters = [], int $perPage = 20): LengthAwarePaginator
    {
        $perPage = isset($filters['per_page']) ? (int) $filters['per_page'] : $perPage;
        unset($filters['per_page']);

        return $this->newQuery()
            ->with('organizations')
            ->when(count($filters) > 0, fn (Builder $query) => $this->applyFilters($query, $filters))
            ->paginate(min($perPage, 100));
    }

    public function tree(): Collection
    {
        return $this->newQuery()
            ->whereNull('parent_id')
            ->with('organizations')
            ->with('children.children.organizations')
            ->get();
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
        $query
            ->when($filters['search'] ?? null, fn (Builder $q, string $v) => $q->where('name', 'LIKE', "%{$v}%"))
            ->when($filters['parent_id'] ?? null, fn (Builder $q, string $v) => $q->where('parent_id', $v));
    }
}
