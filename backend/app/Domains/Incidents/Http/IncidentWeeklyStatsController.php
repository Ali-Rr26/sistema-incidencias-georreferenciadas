<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http;

use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Http\Concerns\ScopesIncidentQueries;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

/**
 * Volume incident statistics — received incidents per day.
 *
 * Supports optional date range filtering (inicio/fin).
 * If not provided, defaults to the last 10 days (rolling window).
 * Respects location/category filters same as IncidentStatsController.
 */
class IncidentWeeklyStatsController extends Controller
{
    use ScopesIncidentQueries;

    public function __invoke(Request $request): JsonResponse
    {
        if (! $request->user()?->can('dashboard.view')) {
            abort(403, 'No tienes permiso para ver las estadísticas.');
        }

        $validated = $request->validate([
            'inicio' => 'nullable|date_format:Y-m-d',
            'fin' => 'nullable|date_format:Y-m-d',
            'tipo_id' => 'nullable|integer|exists:incident_categories,id',
            'ciudad_id' => 'nullable|integer|exists:locations,id',
            'provincia_id' => 'nullable|integer|exists:locations,id',
            'pais_id' => 'nullable|integer|exists:locations,id',
        ]);

        // Validate that fin >= inicio if both provided
        if (! empty($validated['inicio']) && ! empty($validated['fin'])) {
            $inicio = Carbon::createFromFormat('Y-m-d', $validated['inicio']);
            $fin = Carbon::createFromFormat('Y-m-d', $validated['fin']);
            if ($fin->isBefore($inicio)) {
                abort(422, 'La fecha fin no puede ser anterior a la fecha inicio.');
            }
        }

        // Determine date range
        if (! empty($validated['inicio']) && ! empty($validated['fin'])) {
            $startDate = Carbon::createFromFormat('Y-m-d', $validated['inicio']);
            $endDate = Carbon::createFromFormat('Y-m-d', $validated['fin']);
        } else {
            // Default: last 10 days
            $endDate = now();
            $startDate = now()->subDays(9);
        }

        // Fetch received incidents (grouped by created_at date)
        $received = $this->fetchDailyCounts('created_at', $startDate, $endDate, $validated);

        // Fetch resolved incidents (grouped by resolution_date date)
        $resolved = $this->fetchDailyCounts('resolution_date', $startDate, $endDate, $validated, IncidentStatus::Resolved->value);

        // Build 7-day series (or custom range)
        $days = [];
        $current = $startDate->copy();
        while ($current->lte($endDate)) {
            $dateStr = $current->format('Y-m-d');
            $dayOfWeekES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][$current->dayOfWeek];

            $days[] = [
                'date' => $dateStr,
                'label' => $dayOfWeekES,
                'recibidas' => $received[$dateStr] ?? 0,
                'resueltas' => $resolved[$dateStr] ?? 0,
            ];

            $current->addDay();
        }

        return response()->json(['days' => $days]);
    }

    /**
     * Fetch daily counts for a given date column.
     *
     * @param  string  $dateColumn  Column to group by (created_at or resolution_date)
     * @param  string|null  $statusFilter  Optional: filter by specific status (e.g., IncidentStatus::Resolved->value)
     * @return array<string, int> [YYYY-MM-DD => count]
     */
    private function fetchDailyCounts(string $dateColumn, Carbon $startDate, Carbon $endDate, array $validated, ?string $statusFilter = null): array
    {
        $driver = DB::connection()->getDriverName();

        // Date formatting per driver
        $dateExpr = match ($driver) {
            'pgsql' => "TO_CHAR({$dateColumn}, 'YYYY-MM-DD')",
            default => "strftime('%Y-%m-%d', {$dateColumn})",
        };

        $query = $this->applyOrgScope(
            DB::table('incidents')
                ->whereNull('deleted_at')
                ->whereBetween($dateColumn, [$startDate, $endDate])
        );

        // Apply filters
        if (! empty($validated['tipo_id'])) {
            $query->where('incident_category_id', $validated['tipo_id']);
        }
        if (! empty($validated['ciudad_id'])) {
            $query = $this->applyLocationFilter($query, 'ciudad_id', $validated['ciudad_id']);
        }
        if (! empty($validated['provincia_id'])) {
            $query = $this->applyLocationFilter($query, 'provincia_id', $validated['provincia_id']);
        }
        if (! empty($validated['pais_id'])) {
            $query = $this->applyLocationFilter($query, 'pais_id', $validated['pais_id']);
        }

        // Status filter (e.g., only resolved for resolution_date counts)
        if ($statusFilter !== null) {
            $query->where('status', $statusFilter);
        }

        $rows = $query
            ->selectRaw("{$dateExpr} as day, COUNT(*) as count")
            ->groupBy('day')
            ->orderBy('day')
            ->get();

        $counts = [];
        foreach ($rows as $row) {
            $counts[$row->day] = (int) $row->count;
        }

        return $counts;
    }
}
