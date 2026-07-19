<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Rules;

use App\Domains\Locations\Repositories\LocationRepository;
use Closure;
use Illuminate\Contracts\Validation\DataAwareRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use MatanYadaev\EloquentSpatial\Objects\Point;

/**
 * Cross-checks the submitted `location_id` against the map `geom` point,
 * when both are present. `locations.geom` (administrative boundaries) is
 * only populated once real polygon data is imported — until then (or for
 * any location whose polygon is still missing), this rule stays silent
 * rather than rejecting: it only fails when it can actually prove the
 * point falls outside the selected location's boundary.
 *
 * `locations.geom` is a PostgreSQL-only column (see
 * `2026_06_15_000002_create_locations_table.php`) — it doesn't exist on
 * sqlite, the default test/CI driver, so the spatial lookup is skipped
 * entirely on any non-pgsql connection.
 */
class LocationGeomConsistentRule implements DataAwareRule, ValidationRule
{
    /** @var array<string, mixed> */
    protected array $data = [];

    public function __construct(protected LocationRepository $locations) {}

    public function setData(array $data): static
    {
        $this->data = $data;

        return $this;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        // No location selected — nothing to cross-check.
        if ($value === null) {
            return;
        }

        // `locations.geom` only exists on pgsql (see the migration referenced
        // above); querying it on any other driver would throw.
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        // No map point submitted (or an empty one) — nothing to compare against.
        $geomRaw = $this->data['geom'] ?? null;
        if ($geomRaw === null || $geomRaw === '') {
            return;
        }

        // Malformed geom is the `geom` field's own `nullable|json` rule's
        // problem to report — this rule only cares about well-formed points.
        $geom = json_decode((string) $geomRaw, true);
        $coordinates = $geom['coordinates'] ?? null;
        if (! is_array($coordinates) || count($coordinates) !== 2) {
            return;
        }

        try {
            [$longitude, $latitude] = $coordinates;
            // SRID must match `locations.geom` (4326) explicitly — ST_CONTAINS
            // throws "Operation on mixed SRID geometries" against a Point left
            // at its default SRID, it does not implicitly coerce.
            $point = new Point((float) $latitude, (float) $longitude, 4326);

            $matched = $this->locations->findByPoint($point);
        } catch (\Throwable $e) {
            // This check is a soft, progressive validation — a broken/corrupt
            // polygon or a spatial-query error must never take down incident
            // create/update, the app's core feature. Skip like "no match".
            Log::warning('LocationGeomConsistentRule: spatial lookup failed', [
                'location_id' => $value,
                'error' => $e->getMessage(),
            ]);

            return;
        }

        // No polygon contains the point — either no boundary data has been
        // imported yet for that area, or the point is genuinely outside any
        // known location. Either way, we can't prove inconsistency, so stay
        // silent rather than reject.
        if ($matched === null) {
            return;
        }

        // Ids come back as numeric strings over pgsql/PDO (Eloquent's
        // pluck() does not cast them) — normalize both sides before the
        // strict comparison, otherwise a valid exact match never matches.
        $validIds = $matched->ancestorsAndSelf()
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (! in_array((int) $value, $validIds, true)) {
            $fail('The selected location does not contain the marked point on the map.');
        }
    }
}
