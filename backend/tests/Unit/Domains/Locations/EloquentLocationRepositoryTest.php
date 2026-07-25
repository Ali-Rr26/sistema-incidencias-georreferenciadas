<?php

declare(strict_types=1);

use App\Domains\Locations\Models\Location;
use App\Domains\Locations\Repositories\EloquentLocationRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use MatanYadaev\EloquentSpatial\Objects\LineString;
use MatanYadaev\EloquentSpatial\Objects\MultiPolygon;
use MatanYadaev\EloquentSpatial\Objects\Point;
use MatanYadaev\EloquentSpatial\Objects\Polygon;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

function locationRepoPostgisAvailable(): bool
{
    return DB::connection()->getDriverName() === 'pgsql';
}

/** A small square polygon: lng ∈ [-80.8, -80.6], lat ∈ [-1.0, -0.8]. */
function locationRepoSquare(): MultiPolygon
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

/**
 * Regression coverage for `findByPoint()` preferring the most specific
 * (deepest) match over an arbitrary one.
 *
 * A point inside a cantón is necessarily also inside that cantón's parent
 * province (the province polygon fully contains it), so more than one row
 * can legitimately match the same point once both province- and
 * cantón-level geometry are loaded (`LocationGeomSeeder`). Before this fix,
 * `findByPoint()` had no explicit ordering — `first()` could arbitrarily
 * return either row. `LocationGeomConsistentRule` walks *up* from the match
 * via `ancestorsAndSelf()`, so an arbitrary coarser match (province instead
 * of cantón) would never contain a deeper submitted `location_id` in that
 * chain, and a legitimate cantón-level submission would be wrongly
 * rejected. This is exactly what surfaced when real boundary data was
 * first loaded for Santa Elena / La Libertad.
 */
it('pgsql: findByPoint returns the most specific (deepest) match when the point is inside both a province and its cantón', function (): void {
    if (! locationRepoPostgisAvailable()) {
        test()->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    $province = Location::create([
        'name' => 'El Oro',
        'level' => 'province',
        'geom' => locationRepoSquare(),
    ]);
    $city = Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'parent_id' => $province->id,
        'geom' => locationRepoSquare(),
    ]);

    $repository = new EloquentLocationRepository;
    $match = $repository->findByPoint(new Point(-0.9, -80.7, 4326));

    expect($match)->not->toBeNull();
    expect($match->id)->toBe($city->id);
    expect($match->level->value)->toBe('city');
});

it('pgsql: findByPoint still returns the province when no cantón polygon contains the point', function (): void {
    if (! locationRepoPostgisAvailable()) {
        test()->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    $province = Location::create([
        'name' => 'El Oro',
        'level' => 'province',
        'geom' => locationRepoSquare(),
    ]);
    // Sibling cantón with no geom set (e.g. still unmatched) — must not
    // block the coarser province match from being found.
    Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'parent_id' => $province->id,
    ]);

    $repository = new EloquentLocationRepository;
    $match = $repository->findByPoint(new Point(-0.9, -80.7, 4326));

    expect($match)->not->toBeNull();
    expect($match->id)->toBe($province->id);
});
