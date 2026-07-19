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
