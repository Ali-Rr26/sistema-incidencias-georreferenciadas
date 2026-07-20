<?php

declare(strict_types=1);

use App\Domains\Incidents\Http\Rules\LocationGeomConsistentRule;
use App\Domains\Locations\Models\Location;
use App\Domains\Locations\Repositories\LocationRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use MatanYadaev\EloquentSpatial\Objects\LineString;
use MatanYadaev\EloquentSpatial\Objects\MultiPolygon;
use MatanYadaev\EloquentSpatial\Objects\Point;
use MatanYadaev\EloquentSpatial\Objects\Polygon;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

/**
 * Direct unit tests for `LocationGeomConsistentRule::validate()`, bypassing
 * HTTP/persistence entirely (no Incident is ever created here) so the
 * driver-guard can be exercised on sqlite without hitting the pgsql-only
 * `incidents.geom` column gap (see the sibling Feature test for that
 * context). This is what actually proves the sqlite short-circuit works,
 * rather than just asserting on it.
 */
function makeRule(): LocationGeomConsistentRule
{
    return new LocationGeomConsistentRule(app(LocationRepository::class));
}

function postgisAvailableForRule(): bool
{
    return DB::connection()->getDriverName() === 'pgsql';
}

function machalaSquareGeom(): MultiPolygon
{
    return new MultiPolygon([
        new Polygon([
            new LineString([
                new Point(-1.0, -80.8),
                new Point(-1.0, -80.6),
                new Point(-0.8, -80.6),
                new Point(-0.8, -80.8),
                new Point(-1.0, -80.8),
            ]),
        ]),
    ]);
}

it('sqlite: never fails, even for a location/point that would mismatch on pgsql', function (): void {
    if (postgisAvailableForRule()) {
        $this->markTestSkipped('This scenario targets the non-pgsql (sqlite) driver-guard path.');
    }

    $location = Location::create(['name' => 'Quito', 'level' => 'city']);
    $rule = makeRule();
    $rule->setData(['geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]])]);

    $failed = false;
    $rule->validate('location_id', $location->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

it('skips when location_id is null', function (): void {
    $rule = makeRule();
    $rule->setData(['geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]])]);

    $failed = false;
    $rule->validate('location_id', null, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

it('skips when geom is absent from sibling data', function (): void {
    if (! postgisAvailableForRule()) {
        $this->markTestSkipped('Requires PostgreSQL — on sqlite this is already covered by the driver-guard test above.');
    }

    $location = Location::create(['name' => 'Quito', 'level' => 'city']);
    $rule = makeRule();
    $rule->setData([]); // no 'geom' key at all

    $failed = false;
    $rule->validate('location_id', $location->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

it('skips when geom coordinates are malformed', function (): void {
    if (! postgisAvailableForRule()) {
        $this->markTestSkipped('Requires PostgreSQL — on sqlite this is already covered by the driver-guard test above.');
    }

    $location = Location::create(['name' => 'Quito', 'level' => 'city']);
    $rule = makeRule();
    $rule->setData(['geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7]])]); // only 1 coordinate

    $failed = false;
    $rule->validate('location_id', $location->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

it('pgsql: skips when the point matches no polygon (no boundary data loaded)', function (): void {
    if (! postgisAvailableForRule()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    $location = Location::create(['name' => 'Machala', 'level' => 'city']); // no geom
    $rule = makeRule();
    $rule->setData(['geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]])]);

    $failed = false;
    $rule->validate('location_id', $location->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

it('pgsql: passes when the point is inside the matched location\'s polygon', function (): void {
    if (! postgisAvailableForRule()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    $location = Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'geom' => machalaSquareGeom(),
    ]);
    $rule = makeRule();
    $rule->setData(['geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]])]);

    $failed = false;
    $rule->validate('location_id', $location->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

it('pgsql: fails when the point is inside the polygon but location_id is unrelated', function (): void {
    if (! postgisAvailableForRule()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'geom' => machalaSquareGeom(),
    ]);
    $quito = Location::create(['name' => 'Quito', 'level' => 'city']);
    $rule = makeRule();
    $rule->setData(['geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]])]);

    $failMessage = null;
    $rule->validate('location_id', $quito->id, function (string $message) use (&$failMessage) {
        $failMessage = $message;
    });

    expect($failMessage)->not->toBeNull();
});

it('pgsql: passes when location_id is an ancestor of the matched location', function (): void {
    if (! postgisAvailableForRule()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    $province = Location::create(['name' => 'El Oro', 'level' => 'province']);
    Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'parent_id' => $province->id,
        'geom' => machalaSquareGeom(),
    ]);
    $rule = makeRule();
    $rule->setData(['geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]])]);

    $failed = false;
    $rule->validate('location_id', $province->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

it('pgsql: submitting the cantón itself still passes when its parent province also has geom set', function (): void {
    if (! postgisAvailableForRule()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    // Regression: once both levels have geom (LocationGeomSeeder loads
    // province + cantón), a point inside the cantón is also inside its
    // parent province polygon. findByPoint() must prefer the cantón (the
    // deepest match) — if it arbitrarily returned the province instead,
    // the submitted cantón id would be a *descendant* of the match, not an
    // ancestor-or-self, and this would wrongly fail.
    $province = Location::create([
        'name' => 'El Oro',
        'level' => 'province',
        'geom' => machalaSquareGeom(),
    ]);
    $city = Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'parent_id' => $province->id,
        'geom' => machalaSquareGeom(),
    ]);
    $rule = makeRule();
    $rule->setData(['geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]])]);

    $failed = false;
    $rule->validate('location_id', $city->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

it('pgsql: tolerates geom arriving as an already-decoded array (real HTTP traffic path)', function (): void {
    if (! postgisAvailableForRule()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    // Regression for the production 500:
    // axios / fetch send `geom` as a JSON object — by the time the rule sees
    // `$this->data['geom']`, it's already-decoded into an array, NOT a JSON
    // string. The previous `(string) $geomRaw` cast produced "Array to string
    // conversion" and Laravel promoted the notice to ErrorException → 500 on
    // every POST /api/incidents. All existing tests covered the string path,
    // so the regression escaped CI.
    $province = Location::create([
        'name' => 'El Oro',
        'level' => 'province',
        'geom' => machalaSquareGeom(),
    ]);
    $city = Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'parent_id' => $province->id,
        'geom' => machalaSquareGeom(),
    ]);

    $rule = makeRule();
    // Same shape the frontend actually posts — array, NOT json_encode()ed.
    $rule->setData(['geom' => ['type' => 'Point', 'coordinates' => [-80.7, -0.9]]]);

    // Cantón submitted, point inside cantón polygon → must not call $fail().
    $failed = false;
    $rule->validate('location_id', $city->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

it('pgsql: tolerates geom arriving as a stdClass object (defensive)', function (): void {
    if (! postgisAvailableForRule()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    // Defensive: a future middleware or a model cast could leak a stdClass
    // down here instead of an array. The previous `(string) $geomRaw` cast
    // would have crashed on that too — the new `match (true)` block must
    // decode it via json_encode→json_decode and keep going.
    $province = Location::create([
        'name' => 'El Oro',
        'level' => 'province',
        'geom' => machalaSquareGeom(),
    ]);
    $city = Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'parent_id' => $province->id,
        'geom' => machalaSquareGeom(),
    ]);

    $rule = makeRule();
    $rule->setData(['geom' => (object) ['type' => 'Point', 'coordinates' => [-80.7, -0.9]]]);

    $failed = false;
    $rule->validate('location_id', $city->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

it('exposes its rejection message in Spanish (end-user readability, pinned)', function (): void {
    if (! postgisAvailableForRule()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    // The rest of the app's validation messages stay in English
    // (`APP_LOCALE=en`), but this is the only error an end user sees when
    // they pick a province + cantón on a map of Ecuador and drop a pin
    // outside the boundary. It's worth pinning so a future i18n sweep
    // doesn't drift this string without an explicit decision.
    $machala = Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'geom' => machalaSquareGeom(),
    ]);
    $quito = Location::create(['name' => 'Quito', 'level' => 'city']);

    $rule = makeRule();
    $rule->setData(['geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]])]);

    $captured = null;
    $rule->validate('location_id', $quito->id, function (string $message) use (&$captured) {
        $captured = $message;
    });

    expect($captured)->toBe('La ubicación seleccionada no contiene el punto marcado en el mapa.');
});
