<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Repositories;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Shared\Repositories\EloquentRepository;
use Illuminate\Database\Eloquent\Builder;

class EloquentIncidentRepository extends EloquentRepository implements IncidentRepository
{
    public function __construct()
    {
        parent::__construct(new Incident);
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
        $query
            ->when($filters['status'] ?? null, fn (Builder $q, string $v) => $q->where('status', $v))
            ->when($filters['priority'] ?? null, fn (Builder $q, string $v) => $q->where('priority', $v))
            ->when($filters['location_id'] ?? null, function (Builder $q, string $v) {
                $location = Location::find((int) $v);
                if ($location) {
                    $ids = $location->descendantsAndSelf()->pluck('id');
                    $q->whereIn('location_id', $ids);
                }
            })
            ->when($filters['incident_category_id'] ?? null, fn (Builder $q, string $v) => $q->where('incident_category_id', $v))
            ->when($filters['user_id'] ?? null, fn (Builder $q, string $v) => $q->where('user_id', $v));
    }
}
