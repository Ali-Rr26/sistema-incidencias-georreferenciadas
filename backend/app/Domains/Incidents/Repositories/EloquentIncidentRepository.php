<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Repositories;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Shared\Repositories\EloquentRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class EloquentIncidentRepository extends EloquentRepository implements IncidentRepository
{
    public function __construct()
    {
        parent::__construct(new Incident);
    }

    /**
     * Override to wrap the write in a transaction and bind the authenticated
     * actor for the audit trigger before the UPDATE fires.
     */
    public function update(int $id, array $data): Model
    {
        return DB::transaction(function () use ($id, $data): Model {
            $this->bindAuditActor();

            $record = $this->findById($id);

            if ($record === null) {
                throw new \RuntimeException("Record [{$this->model->getTable()}] with ID {$id} not found.");
            }

            $record->update($data);

            return $record->fresh();
        });
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
        $query
            ->with(['category', 'location', 'user'])
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

    /**
     * Set the PostgreSQL session variable used by the audit trigger to record
     * the actor who performed the write.  Only runs on pgsql and when a user
     * is authenticated; otherwise the trigger falls back to COALESCE(user_id).
     */
    private function bindAuditActor(): void
    {
        if (DB::getDriverName() === 'pgsql' && Auth::id() !== null) {
            DB::statement("SELECT set_config('app.current_user_id', ?, true)", [(string) Auth::id()]);
        }
    }
}
