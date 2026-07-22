<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Auth\Middleware\Authorize;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use MatanYadaev\EloquentSpatial\Objects\LineString;
use MatanYadaev\EloquentSpatial\Objects\MultiPolygon;
use MatanYadaev\EloquentSpatial\Objects\Point;
use MatanYadaev\EloquentSpatial\Objects\Polygon;

/**
 * Feature (HTTP round-trip) tests for `LocationGeomConsistentRule`.
 *
 * Both `locations.geom` AND `incidents.geom` are PostgreSQL-only columns
 * (see `2026_06_15_000002_create_locations_table.php` and
 * `2026_06_15_000005_create_incidents_table.php` — both guard the column
 * behind `getDriverName() === 'pgsql'`). On sqlite (default CI/test
 * driver) submitting a `geom` value to `POST /incidents` fails at the DB
 * layer regardless of this rule — that's a pre-existing repo constraint,
 * not something introduced here. So the full HTTP round-trip scenarios
 * that involve `geom` only run when PostgreSQL is available (same
 * `postgisAvailable()` skip pattern as `IncidentMapBoundsTest`); the
 * driver-guard itself (rule never queries `locations.geom` on sqlite) is
 * covered without touching the incidents table at all, in the sibling
 * unit test `tests/Unit/Domains/Incidents/LocationGeomConsistentRuleTest.php`.
 */
uses(RefreshDatabase::class);

function locationGeomPostgisAvailable(): bool
{
    return DB::connection()->getDriverName() === 'pgsql';
}

/** A small square polygon: lng ∈ [-80.8, -80.6], lat ∈ [-1.0, -0.8] (Machala-ish). */
function machalaSquare(): MultiPolygon
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

beforeEach(function (): void {
    $this->withoutMiddleware([
        JwtAuthenticate::class,
        Authorize::class,
    ]);

    Storage::fake('s3');

    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema'],
    ]);

    $this->systemAdmin = User::factory()->create([
        'role_id' => 1,
        'organization_id' => null,
    ]);

    $orgLocation = Location::create(['name' => 'Org Base Location', 'level' => 'city']);
    $this->organization = Organization::create([
        'name' => 'Org A',
        'location_id' => $orgLocation->id,
    ]);
    $this->category = IncidentCategory::create([
        'name' => 'General',
        'organization_id' => $this->organization->id,
    ]);
});

function locationGeomBasePayload(array $overrides = []): array
{
    return array_merge([
        'title' => 'Fuga de agua',
        'priority' => 'medium',
        'incident_category_id' => test()->category->id,
        'organization_id' => test()->organization->id,
    ], $overrides);
}

it('location_id present without geom passes (nothing to cross-check, sqlite-safe)', function (): void {
    $location = Location::create(['name' => 'Machala', 'level' => 'city']);
    $this->actingAs($this->systemAdmin);

    $response = $this->postJson('/api/incidents', locationGeomBasePayload([
        'location_id' => $location->id,
    ]));

    $response->assertCreated();
});

it('pgsql: a point matching no polygon at all passes (no boundary data loaded yet)', function (): void {
    if (! locationGeomPostgisAvailable()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS (geom column not created on other drivers).');
    }

    $location = Location::create(['name' => 'Machala', 'level' => 'city']); // no geom set
    $this->actingAs($this->systemAdmin);

    $response = $this->postJson('/api/incidents', locationGeomBasePayload([
        'location_id' => $location->id,
        'geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]]),
    ]));

    $response->assertCreated();
});

it('pgsql: a point inside the selected location\'s polygon passes', function (): void {
    if (! locationGeomPostgisAvailable()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    $location = Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'geom' => machalaSquare(),
    ]);
    $this->actingAs($this->systemAdmin);

    $response = $this->postJson('/api/incidents', locationGeomBasePayload([
        'location_id' => $location->id,
        'geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]]), // inside the square
    ]));

    $response->assertCreated();
});

it('pgsql: a point inside the polygon but a mismatched location_id is rejected with 422', function (): void {
    if (! locationGeomPostgisAvailable()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'geom' => machalaSquare(),
    ]);
    $quito = Location::create(['name' => 'Quito', 'level' => 'city']); // unrelated, no geom
    $this->actingAs($this->systemAdmin);

    $response = $this->postJson('/api/incidents', locationGeomBasePayload([
        'location_id' => $quito->id,
        'geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]]), // inside Machala's square, not Quito
    ]));

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['location_id']);
});

it('pgsql: submitting the matched location\'s ancestor (broader level) still passes', function (): void {
    if (! locationGeomPostgisAvailable()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    $province = Location::create(['name' => 'El Oro', 'level' => 'province']);
    Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'parent_id' => $province->id,
        'geom' => machalaSquare(),
    ]);
    $this->actingAs($this->systemAdmin);

    // Submitting the ancestor (province) of the matched location is still
    // consistent — the user just chose a broader level than the polygon.
    $response = $this->postJson('/api/incidents', locationGeomBasePayload([
        'location_id' => $province->id,
        'geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]]),
    ]));

    $response->assertCreated();
});

// ──────────────────────────────────────────────────────────────
// multipart/form-data — the real frontend path whenever images are
// attached. `geom` arrives as a JSON string field (see
// `fix(incidencias): serialize geom as JSON before FormData submit`), not
// a JSON body — this must be proven to work the same way as postJson().
// ──────────────────────────────────────────────────────────────

it('pgsql: multipart submission (with an image) still passes for a consistent point', function (): void {
    if (! locationGeomPostgisAvailable()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    $location = Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'geom' => machalaSquare(),
    ]);
    $this->actingAs($this->systemAdmin);

    $response = $this->post('/api/incidents', locationGeomBasePayload([
        'location_id' => $location->id,
        'geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]]),
        'images' => [UploadedFile::fake()->image('evidencia.jpg')],
    ]));

    $response->assertCreated();
});

it('pgsql: multipart submission (with an image) is rejected for a mismatched location_id', function (): void {
    if (! locationGeomPostgisAvailable()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'geom' => machalaSquare(),
    ]);
    $quito = Location::create(['name' => 'Quito', 'level' => 'city']);
    $this->actingAs($this->systemAdmin);

    $response = $this->post('/api/incidents', locationGeomBasePayload([
        'location_id' => $quito->id,
        'geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]]),
        'images' => [UploadedFile::fake()->image('evidencia.jpg')],
    ]));

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['location_id']);
});

// ──────────────────────────────────────────────────────────────
// Update path — `sometimes` on `location_id`. Never exercised by the
// pre-existing UpdateIncidentRequestTest.php, and this rule's behavior on
// partial updates (location_id present without geom) is only proven by
// static reading unless a test actually runs it.
// ──────────────────────────────────────────────────────────────

it('location_id present without geom on update passes (sqlite-safe — nothing to cross-check)', function (): void {
    $location = Location::create(['name' => 'Machala', 'level' => 'city']);
    $otherLocation = Location::create(['name' => 'Quito', 'level' => 'city']);
    $incident = Incident::create([
        'title' => 'Existing incident',
        'incident_category_id' => $this->category->id,
        'organization_id' => $this->organization->id,
        'user_id' => $this->systemAdmin->id,
        'location_id' => $location->id,
        'status' => 'pending',
        'priority' => 'medium',
    ]);
    $this->actingAs($this->systemAdmin);

    // Partial update: change location_id only, no geom in this payload at
    // all — the rule must skip (nothing to cross-check), not reject.
    $response = $this->putJson("/api/incidents/{$incident->id}", [
        'location_id' => $otherLocation->id,
    ]);

    $response->assertOk();
});

it('pgsql: update with a mismatched location_id + geom is rejected with 422', function (): void {
    if (! locationGeomPostgisAvailable()) {
        $this->markTestSkipped('Requires PostgreSQL+PostGIS.');
    }

    Location::create([
        'name' => 'Machala',
        'level' => 'city',
        'geom' => machalaSquare(),
    ]);
    $quito = Location::create(['name' => 'Quito', 'level' => 'city']);
    $incident = Incident::create([
        'title' => 'Existing incident',
        'incident_category_id' => $this->category->id,
        'organization_id' => $this->organization->id,
        'user_id' => $this->systemAdmin->id,
        'location_id' => $quito->id,
        'status' => 'pending',
        'priority' => 'medium',
    ]);
    $this->actingAs($this->systemAdmin);

    $response = $this->putJson("/api/incidents/{$incident->id}", [
        'location_id' => $quito->id,
        'geom' => json_encode(['type' => 'Point', 'coordinates' => [-80.7, -0.9]]), // inside Machala, not Quito
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['location_id']);
});
