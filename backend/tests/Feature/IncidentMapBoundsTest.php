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
use Illuminate\Support\Facades\DB;
use MatanYadaev\EloquentSpatial\Objects\Point;

/**
 * Tests for the `bbox` query parameter on `GET /api/incidents`.
 *
 * Tests that exercise the PostGIS `ST_Within(...)` predicate require a
 * real PostgreSQL+PostGIS connection. The default CI driver is sqlite
 * (the geom column is created only on pgsql in the migration), so those
 * tests are skipped on non-pgsql drivers. Validation tests run on any
 * driver because they short-circuit before the SQL ever executes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CI REQUIREMENTS — READ BEFORE TOUCHING THIS FILE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The PostGIS-backed scenarios (SCEN-1.2 / 1.3 / 1.5) MUST be executed
 * against PostgreSQL + PostGIS in CI; otherwise they get marked as
 * skipped and the spatial index coverage (see migration
 * `2026_07_08_000001_add_geom_gist_indexes.php`) is not validated.
 *
 * Required services on the CI runner:
 *
 *   - Postgres 14+ (any 12+ should work; we test with the image used
 *     in `.github/workflows/ci.yml`).
 *   - PostGIS extension installed (`CREATE EXTENSION postgis`).
 *
 * `phpunit.xml` pins `DB_CONNECTION=sqlite` for the default test run.
 * To force pgsql on a job, override via env vars BEFORE invoking
 * `php artisan test` / `composer run test`:
 *
 *   DB_CONNECTION=pgsql \
 *   DB_HOST=127.0.0.1 \
 *   DB_PORT=5432 \
 *   DB_DATABASE=sistema_incidencias_test \
 *   DB_USERNAME=postgres \
 *   DB_PASSWORD=postgres \
 *     composer run test
 *
 * The `postgisAvailable()` helper below returns true only on pgsql and
 * is the single source of truth for the per-test skip. Do NOT replace
 * the `markTestSkipped` calls with hard failures — that would break the
 * sqlite default and force every contributor to spin up Postgres. The
 * right place to fail is CI configuration, not the test body.
 * ─────────────────────────────────────────────────────────────────────────────
 */
uses(RefreshDatabase::class);

/**
 * @return bool true when the current DB connection is PostgreSQL with PostGIS.
 */
function postgisAvailable(): bool
{
    return DB::connection()->getDriverName() === 'pgsql';
}

beforeEach(function (): void {
    // The route is protected by `jwt` middleware and the controller binds
    // `authorizeResource(Incident::class, 'incident)` which checks the
    // `incidents.view` permission via the Gate. In unit tests we don't run
    // the full RBAC seeder, so we disable both middlewares.
    $this->withoutMiddleware([
        JwtAuthenticate::class,
        Authorize::class,
    ]);

    // ── Roles ───────────────────────────────────────────────
    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema'],
        ['id' => 2, 'name' => 'admin_organizacion'],
        ['id' => 3, 'name' => 'operador_organizacion'],
        ['id' => 4, 'name' => 'publicador'],
        ['id' => 5, 'name' => 'usuario'],
    ]);

    $this->location = Location::create(['name' => 'Machala', 'level' => 'city']);

    $this->orgA = Organization::create([
        'name' => 'Org A',
        'location_id' => $this->location->id,
    ]);
    $this->orgB = Organization::create([
        'name' => 'Org B',
        'location_id' => $this->location->id,
    ]);

    $this->category = IncidentCategory::create([
        'name' => 'General',
        'organization_id' => $this->orgA->id,
    ]);

    $this->systemAdmin = User::factory()->create([
        'role_id' => 1,
        'organization_id' => null,
    ]);

    // Three seed incidents (no geom) — used by SCEN-1.1.
    foreach (range(1, 3) as $i) {
        Incident::create([
            'title' => "Seed incident #{$i}",
            'incident_category_id' => $this->category->id,
            'user_id' => $this->systemAdmin->id,
            'location_id' => $this->location->id,
            'organization_id' => $this->orgA->id,
            'status' => 'pending',
            'priority' => 'medium',
        ]);
    }
});

// ──────────────────────────────────────────────────────────────
// SCEN-1.1: sin bbox el endpoint se comporta idéntico al index previo
// ──────────────────────────────────────────────────────────────

it('SCEN-1.1: without bbox the index endpoint returns all incidents as before', function (): void {
    $this->actingAs($this->systemAdmin);

    $response = $this->getJson('/api/incidents');

    $response->assertOk();
    $response->assertJsonPath('meta.total', 3);

    $ids = collect($response->json('data'))->pluck('id')->all();
    expect($ids)->toHaveCount(3);
});

// ──────────────────────────────────────────────────────────────
// SCEN-1.2: bbox que cubre Machala sólo devuelve incidencias dentro del rectángulo
// ──────────────────────────────────────────────────────────────

it('SCEN-1.2: bbox filter returns only incidents whose geom lies inside the envelope', function (): void {
    if (! postgisAvailable()) {
        $this->markTestSkipped('SCEN-1.2 requires PostgreSQL+PostGIS (geom column is not created on other drivers).');
    }

    $this->actingAs($this->systemAdmin);

    // Machala-ish box: lng ∈ [-80.8, -80.6], lat ∈ [-1.0, -0.8]
    //
    // NOTE on edges: ST_Within between a Point and an envelope generated by
    // ST_MakeEnvelope treats boundary inclusion differently across PostGIS
    // versions and depending on which edge the point lands on (PostGIS 3.5
    // does NOT guarantee inclusion of points exactly on the envelope's
    // minimum boundary — verified empirically). The frontend over-fetches
    // by a small margin anyway, so we don't depend on edge inclusion here.
    //
    // - inside the box       → -80.7, -0.9  (well inside)
    // - inside, near edge    → -80.65, -0.85 (close to maxLng/maxLat — still inside)
    // - outside south        → -80.7, -1.1  (below minLat)
    // - outside east         → -78.5, -0.9  (Quito — beyond maxLng)
    Incident::create([
        'title' => 'Inside Machala box (center)',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->systemAdmin->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->orgA->id,
        'status' => 'pending',
        'priority' => 'medium',
        'geom' => new Point(-0.9, -80.7, 4326),
    ]);
    Incident::create([
        'title' => 'Inside Machala box (near NE corner)',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->systemAdmin->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->orgA->id,
        'status' => 'pending',
        'priority' => 'medium',
        'geom' => new Point(-0.85, -80.65, 4326),
    ]);
    Incident::create([
        'title' => 'Outside south of box',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->systemAdmin->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->orgA->id,
        'status' => 'pending',
        'priority' => 'medium',
        'geom' => new Point(-1.1, -80.7, 4326),
    ]);
    Incident::create([
        'title' => 'Outside east of box (Quito)',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->systemAdmin->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->orgA->id,
        'status' => 'pending',
        'priority' => 'medium',
        'geom' => new Point(-0.9, -78.5, 4326),
    ]);

    $response = $this->getJson('/api/incidents?bbox=-80.8,-1.0,-80.6,-0.8');

    $response->assertOk();
    $titles = collect($response->json('data'))->pluck('title')->all();

    expect($titles)->toContain('Inside Machala box (center)');
    expect($titles)->toContain('Inside Machala box (near NE corner)');
    expect($titles)->not->toContain('Outside south of box');
    expect($titles)->not->toContain('Outside east of box (Quito)');
    expect($titles)->not->toContain('Seed incident #1');
    expect($titles)->not->toContain('Seed incident #2');
    expect($titles)->not->toContain('Seed incident #3');
});

// ──────────────────────────────────────────────────────────────
// SCEN-1.3: bbox compone con multitenant (SystemAdmin ve todo, OrgAdmin sólo lo suyo)
// ──────────────────────────────────────────────────────────────

it('SCEN-1.3: bbox composes with multitenant scoping', function (): void {
    if (! postgisAvailable()) {
        $this->markTestSkipped('SCEN-1.3 requires PostgreSQL+PostGIS.');
    }

    // Org A inside the box
    Incident::create([
        'title' => 'Org A inside box',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->systemAdmin->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->orgA->id,
        'status' => 'pending',
        'priority' => 'medium',
        'geom' => new Point(-0.9, -80.7, 4326),
    ]);

    // Org B inside the box (different tenant, same coords)
    $categoryB = IncidentCategory::create([
        'name' => 'General B',
        'organization_id' => $this->orgB->id,
    ]);
    Incident::create([
        'title' => 'Org B inside box',
        'incident_category_id' => $categoryB->id,
        'user_id' => $this->systemAdmin->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->orgB->id,
        'status' => 'pending',
        'priority' => 'medium',
        'geom' => new Point(-0.9, -80.7, 4326),
    ]);

    $url = '/api/incidents?bbox=-80.8,-1.0,-80.6,-0.8';

    // SystemAdmin sees both (Org A + Org B) inside the box
    $this->actingAs($this->systemAdmin);
    $adminResponse = $this->getJson($url);
    $adminResponse->assertOk();
    $adminTitles = collect($adminResponse->json('data'))->pluck('title')->all();
    expect($adminTitles)->toContain('Org A inside box');
    expect($adminTitles)->toContain('Org B inside box');

    // Operator from Org A only sees Org A's incidents in the box
    $operatorA = User::factory()->create([
        'role_id' => 3, // operador_organizacion
        'organization_id' => $this->orgA->id,
    ]);
    $this->actingAs($operatorA);
    $opResponse = $this->getJson($url);
    $opResponse->assertOk();
    $opTitles = collect($opResponse->json('data'))->pluck('title')->all();
    expect($opTitles)->toContain('Org A inside box');
    expect($opTitles)->not->toContain('Org B inside box');
});

// ──────────────────────────────────────────────────────────────
// SCEN-1.4: bbox con formato inválido → 422
// ──────────────────────────────────────────────────────────────

it('SCEN-1.4: malformed bbox string returns 422 validation error', function (): void {
    $this->actingAs($this->systemAdmin);

    $response = $this->getJson('/api/incidents?bbox=abc');

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['bbox']);
});

// ──────────────────────────────────────────────────────────────
// SCEN-1.5: bbox válido sin coincidencias → 200 con data vacía
// ──────────────────────────────────────────────────────────────

it('SCEN-1.5: valid bbox that contains no incidents returns 200 with empty data', function (): void {
    if (! postgisAvailable()) {
        $this->markTestSkipped('SCEN-1.5 requires PostgreSQL+PostGIS (ST_Within is not implemented on other drivers).');
    }

    $this->actingAs($this->systemAdmin);

    // Box over the Pacific Ocean — well away from any seed incident.
    $response = $this->getJson('/api/incidents?bbox=-150.0,-10.0,-140.0,0.0');

    $response->assertOk();
    $response->assertJsonPath('meta.total', 0);
    $response->assertJsonPath('data', []);
});

// ──────────────────────────────────────────────────────────────
// SCEN-1.6: zoom fuera de [1,22] → 422
// ──────────────────────────────────────────────────────────────

it('SCEN-1.6: zoom outside 1..22 returns 422 validation error', function (): void {
    $this->actingAs($this->systemAdmin);

    foreach ([0, 23, 99, -5] as $bad) {
        $response = $this->getJson('/api/incidents?zoom='.$bad);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['zoom']);
    }

    // Boundary values are accepted.
    foreach ([1, 22] as $good) {
        $response = $this->getJson('/api/incidents?zoom='.$good);
        $response->assertOk();
    }
});
