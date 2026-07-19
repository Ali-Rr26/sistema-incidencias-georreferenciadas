<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Rules;

use App\Domains\Locations\Repositories\LocationRepository;
use Closure;
use Illuminate\Contracts\Validation\DataAwareRule;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\DB;
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
        if ($value === null) {
            return;
        }

        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        $geomRaw = $this->data['geom'] ?? null;
        if ($geomRaw === null || $geomRaw === '') {
            return;
        }

        $geom = json_decode((string) $geomRaw, true);
        $coordinates = $geom['coordinates'] ?? null;
        if (! is_array($coordinates) || count($coordinates) !== 2) {
            return;
        }

        [$longitude, $latitude] = $coordinates;
        $point = new Point((float) $latitude, (float) $longitude);

        $matched = $this->locations->findByPoint($point);
        if ($matched === null) {
            return;
        }

        $validIds = $matched->ancestorsAndSelf()->pluck('id')->all();

        if (! in_array((int) $value, $validIds, true)) {
            $fail('The selected location does not contain the marked point on the map.');
        }
    }
}
