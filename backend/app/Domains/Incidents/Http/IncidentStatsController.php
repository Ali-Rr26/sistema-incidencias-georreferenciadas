<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http;

use App\Domains\Incidents\Enums\IncidentPriority;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
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
        $driver = DB::connection()->getDriverName();
        if ($driver === 'pgsql') {
            $averageSeconds = DB::table('incidents')
                ->where('status', IncidentStatus::Resolved->value)
                ->whereNotNull('resolution_date')
                ->value(DB::raw('AVG(EXTRACT(EPOCH FROM (resolution_date - created_at)))'));
        } else { // sqlite
            $averageSeconds = DB::table('incidents')
                ->where('status', IncidentStatus::Resolved->value)
                ->whereNotNull('resolution_date')
                ->value(DB::raw("AVG(strftime('%s', resolution_date) - strftime('%s', created_at))"));
        }

        $averageResolutionTime = null;
        if ($averageSeconds !== null) {
            $averageSeconds = (float) $averageSeconds;
            $days = (int) floor($averageSeconds / 86400);
            $hours = (int) floor(($averageSeconds % 86400) / 3600);
            $averageResolutionTime = [
                'formatted' => "{$days} days, {$hours} hours",
                'days' => $days,
                'hours' => $hours,
                'seconds' => (int) round($averageSeconds),
            ];
        }

        return response()->json([
            'total' => Incident::query()->count(),
            'by_status' => $this->groupCounts('status', IncidentStatus::values()),
            'by_priority' => $this->groupCounts('priority', IncidentPriority::values()),
            'recent_count' => Incident::query()
                ->where('created_at', '>=', now()->subDays(7))
                ->count(),
            'locations_count' => Incident::query()
                ->whereNotNull('location_id')
                ->distinct()
                ->count('location_id'),
            'average_resolution_time' => $averageResolutionTime,
        ]);
    }

    /**
     * Build a count map for the given column, zero-filling any known
     * values that did not appear in the aggregate query.
     */
    private function groupCounts(string $column, array $knownValues): array
    {
        $rows = DB::table('incidents')
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
}
