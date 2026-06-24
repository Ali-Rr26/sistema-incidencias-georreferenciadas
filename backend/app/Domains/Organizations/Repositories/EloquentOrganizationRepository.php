<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Repositories;

use App\Domains\Organizations\Models\Organization;
use App\Domains\Shared\Repositories\EloquentRepository;
use Illuminate\Database\Eloquent\Builder;

class EloquentOrganizationRepository extends EloquentRepository implements OrganizationRepository
{
    public function __construct()
    {
        parent::__construct(new Organization());
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
        $query
            ->when($filters['search'] ?? null, fn (Builder $q, string $v) => $q->where('name', 'LIKE', "%{$v}%"))
            ->when($filters['location_id'] ?? null, fn (Builder $q, string $v) => $q->where('location_id', $v));
    }
}
