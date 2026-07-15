<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http;

use App\Domains\Incidents\Enums\IncidentPriority;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Aggregates incident counts for the dashboard.
 *
 * Mirrors the English enum values exposed by `IncidentStatus` and
 * `IncidentPriority` so the frontend can read them by name without an
 * extra lookup. Known enum values are always present in the response
 * (zero-filled if no rows exist) so consumers can rely on the shape.
 */
class IncidentStatsController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'inicio' => 'nullable|date_format:Y-m-d',
            'fin' => [
                'nullable',
                'date_format:Y-m-d',
                Rule::when(
                    $request->filled('inicio') && $request->filled('fin'),
                    fn ($rule) => $rule->after(function ($fail) use ($request) {
                        $inicio = \Carbon\Carbon::createFromFormat('Y-m-d', $request->input('inicio'));
                        $fin = \Carbon\Carbon::createFromFormat('Y-m-d', $request->input('fin'));
                        if ($fin->isBefore($inicio)) {
                            $fail('La fecha fin no puede ser anterior a la fecha inicio.');
                        }
                    })
                ),
            ],
            'tipo_id' => 'nullable|integer|exists:incident_categories,id',
            'ciudad_id' => 'nullable|integer|exists:locations,id',
            'provincia_id' => 'nullable|integer|exists:locations,id',
            'pais_id' => 'nullable|integer|exists:locations,id',
        ]);

        $driver = DB::connection()->getDriverName();
        if ($driver === 'pgsql') {
            $averageSeconds = $this->applyOrgScope(
                DB::table('incidents')
                    ->whereNull('deleted_at')
                    ->where('status', IncidentStatus::Resolved->value)
                    ->whereNotNull('resolution_date'),
            )
                ->when($validated['inicio'] ?? null, fn (QueryBuilder $q) => $q->whereDate('created_at', '>=', $validated['inicio']))
                ->when($validated['fin'] ?? null, fn (QueryBuilder $q) => $q->whereDate('created_at', '<=', $validated['fin']))
                ->when($validated['tipo_id'] ?? null, fn (QueryBuilder $q) => $q->where('incident_category_id', $validated['tipo_id']))
                ->when($validated['ciudad_id'] ?? null, fn (QueryBuilder $q) => $this->applyLocationFilter($q, 'ciudad_id', $validated['ciudad_id']))
                ->when($validated['provincia_id'] ?? null, fn (QueryBuilder $q) => $this->applyLocationFilter($q, 'provincia_id', $validated['provincia_id']))
                ->when($validated['pais_id'] ?? null, fn (QueryBuilder $q) => $this->applyLocationFilter($q, 'pais_id', $validated['pais_id']))
                ->value(DB::raw('AVG(EXTRACT(EPOCH FROM (resolution_date - created_at)))'));
        } else { // sqlite
            $averageSeconds = $this->applyOrgScope(
                DB::table('incidents')
                    ->whereNull('deleted_at')
                    ->where('status', IncidentStatus::Resolved->value)
                    ->whereNotNull('resolution_date'),
            )
                ->when($validated['inicio'] ?? null, fn (QueryBuilder $q) => $q->whereDate('created_at', '>=', $validated['inicio']))
                ->when($validated['fin'] ?? null, fn (QueryBuilder $q) => $q->whereDate('created_at', '<=', $validated['fin']))
                ->when($validated['tipo_id'] ?? null, fn (QueryBuilder $q) => $q->where('incident_category_id', $validated['tipo_id']))
                ->when($validated['ciudad_id'] ?? null, fn (QueryBuilder $q) => $this->applyLocationFilter($q, 'ciudad_id', $validated['ciudad_id']))
                ->when($validated['provincia_id'] ?? null, fn (QueryBuilder $q) => $this->applyLocationFilter($q, 'provincia_id', $validated['provincia_id']))
                ->when($validated['pais_id'] ?? null, fn (QueryBuilder $q) => $this->applyLocationFilter($q, 'pais_id', $validated['pais_id']))
                ->value(DB::raw("AVG(strftime('%s', resolution_date) - strftime('%s', created_at))"));
        }

        $averageResolutionTime = null;
        if ($averageSeconds !== null) {
            $averageSeconds = (float) $averageSeconds;
            $days = (int) floor($averageSeconds / 86400);
            $hours = (int) floor(($averageSeconds % 86400) / 3600);
            $averageResolutionTime = [
                'formatted' => "{$days}d {$hours}h",
                'days' => $days,
                'hours' => $hours,
                'seconds' => (int) round($averageSeconds),
            ];
        }

        return response()->json([
            'total' => $this->applyOrgScope(Incident::query())
                ->when($validated['inicio'] ?? null, fn (Builder $q) => $q->whereDate('created_at', '>=', $validated['inicio']))
                ->when($validated['fin'] ?? null, fn (Builder $q) => $q->whereDate('created_at', '<=', $validated['fin']))
                ->when($validated['tipo_id'] ?? null, fn (Builder $q) => $q->where('incident_category_id', $validated['tipo_id']))
                ->when($validated['ciudad_id'] ?? null, fn (Builder $q) => $this->applyLocationFilterEloquent($q, 'ciudad_id', $validated['ciudad_id']))
                ->when($validated['provincia_id'] ?? null, fn (Builder $q) => $this->applyLocationFilterEloquent($q, 'provincia_id', $validated['provincia_id']))
                ->when($validated['pais_id'] ?? null, fn (Builder $q) => $this->applyLocationFilterEloquent($q, 'pais_id', $validated['pais_id']))
                ->count(),
            'by_status' => $this->groupCounts('status', IncidentStatus::values(), $validated),
            'by_priority' => $this->groupCounts('priority', IncidentPriority::values(), $validated),
            'recent_count' => $this->applyOrgScope(
                Incident::query()->where('created_at', '>=', now()->subDays(7)),
            )
                ->when($validated['tipo_id'] ?? null, fn (Builder $q) => $q->where('incident_category_id', $validated['tipo_id']))
                ->when($validated['ciudad_id'] ?? null, fn (Builder $q) => $this->applyLocationFilterEloquent($q, 'ciudad_id', $validated['ciudad_id']))
                ->when($validated['provincia_id'] ?? null, fn (Builder $q) => $this->applyLocationFilterEloquent($q, 'provincia_id', $validated['provincia_id']))
                ->when($validated['pais_id'] ?? null, fn (Builder $q) => $this->applyLocationFilterEloquent($q, 'pais_id', $validated['pais_id']))
                ->count(),
            'locations_count' => $this->applyOrgScope(
                Incident::query()->whereNotNull('location_id'),
            )
                ->when($validated['inicio'] ?? null, fn (Builder $q) => $q->whereDate('created_at', '>=', $validated['inicio']))
                ->when($validated['fin'] ?? null, fn (Builder $q) => $q->whereDate('created_at', '<=', $validated['fin']))
                ->when($validated['tipo_id'] ?? null, fn (Builder $q) => $q->where('incident_category_id', $validated['tipo_id']))
                ->when($validated['ciudad_id'] ?? null, fn (Builder $q) => $this->applyLocationFilterEloquent($q, 'ciudad_id', $validated['ciudad_id']))
                ->when($validated['provincia_id'] ?? null, fn (Builder $q) => $this->applyLocationFilterEloquent($q, 'provincia_id', $validated['provincia_id']))
                ->when($validated['pais_id'] ?? null, fn (Builder $q) => $this->applyLocationFilterEloquent($q, 'pais_id', $validated['pais_id']))
                ->distinct()
                ->count('location_id'),
            'average_resolution_time' => $averageResolutionTime,
        ]);
    }

    /**
     * Build a count map for the given column, zero-filling any known
     * values that did not appear in the aggregate query.
     */
    private function groupCounts(string $column, array $knownValues, array $validated = []): array
    {
        $rows = $this->applyOrgScope(
            DB::table('incidents')->whereNull('deleted_at'),
        )
            ->when($validated['inicio'] ?? null, fn (QueryBuilder $q) => $q->whereDate('created_at', '>=', $validated['inicio']))
            ->when($validated['fin'] ?? null, fn (QueryBuilder $q) => $q->whereDate('created_at', '<=', $validated['fin']))
            ->when($validated['tipo_id'] ?? null, fn (QueryBuilder $q) => $q->where('incident_category_id', $validated['tipo_id']))
            ->when($validated['ciudad_id'] ?? null, fn (QueryBuilder $q) => $this->applyLocationFilter($q, 'ciudad_id', $validated['ciudad_id']))
            ->when($validated['provincia_id'] ?? null, fn (QueryBuilder $q) => $this->applyLocationFilter($q, 'provincia_id', $validated['provincia_id']))
            ->when($validated['pais_id'] ?? null, fn (QueryBuilder $q) => $this->applyLocationFilter($q, 'pais_id', $validated['pais_id']))
            ->selectRaw("{$column} as key, COUNT(*) as count")
            ->groupBy($column)
            ->get();

        $counts = array_fill_keys($knownValues, 0);
        foreach ($rows as $row) {
            if (in_array($row->key, $knownValues, true)) {
                $counts[$row->key] = (int) $row->count;
            }
        }

        return $counts;
    }

    /**
     * Apply location hierarchy filter to query builder (Query\Builder).
     * Resolves location descendants when filtering by parent (country → provinces → cities).
     */
    private function applyLocationFilter(QueryBuilder $query, string $filterType, int $locationId): QueryBuilder
    {
        $location = Location::find($locationId);
        if ($location === null) {
            return $query;
        }

        $descendantIds = $location->descendantsAndSelf()
            ->pluck('id')
            ->toArray();

        return $query->whereIn('location_id', $descendantIds);
    }

    /**
     * Apply location hierarchy filter to Eloquent builder.
     * Mirrors applyLocationFilter for Eloquent queries.
     */
    private function applyLocationFilterEloquent(Builder $query, string $filterType, int $locationId): Builder
    {
        $location = Location::find($locationId);
        if ($location === null) {
            return $query;
        }

        $descendantIds = $location->descendantsAndSelf()
            ->pluck('id')
            ->toArray();

        return $query->whereIn('location_id', $descendantIds);
    }

    /**
     * Mirrors the scoping in EloquentIncidentRepository::applyFilters
     * (REQ-RBAC-03) — this controller runs its own aggregate queries
     * instead of going through the repository, so the org boundary has
     * to be re-applied here or org-scoped roles see system-wide totals.
     *
     * @template TBuilder of \Illuminate\Database\Eloquent\Builder|\Illuminate\Database\Query\Builder
     *
     * @param  TBuilder  $query
     * @return TBuilder
     */
    private function applyOrgScope($query)
    {
        /** @var User|null $user */
        $user = Auth::user();

        if ($user !== null && ! $user->isSystemAdmin()) {
            if ($user->isOrganizationAdmin() || $user->isOperator()) {
                $query->where('organization_id', $user->organization_id);
            }
            if ($user->isRegularUser()) {
                $query->whereRaw('1 = 0');
            }
        }

        return $query;
    }
}
