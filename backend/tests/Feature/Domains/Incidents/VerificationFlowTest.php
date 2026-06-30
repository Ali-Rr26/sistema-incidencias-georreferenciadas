<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentVerification;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Models\Role;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    // ── Setup ─────────────────────────────────────────────────
    \Illuminate\Support\Facades\DB::table('roles')->insert([
        ['id' => 1, 'name' => 'Admin'],
        ['id' => 3, 'name' => 'publicador'],
    ]);

    $this->location = Location::create(['name' => 'Test City', 'level' => 'city']);

    $placeholderOrg = Organization::create([
        'name' => 'Placeholder',
        'location_id' => $this->location->id,
        'max_active_claims' => 5,
    ]);
    $this->category = IncidentCategory::create(['name' => 'Accidents', 'organization_id' => $placeholderOrg->id]);
    $this->otherCategory = IncidentCategory::create(['name' => 'Fires', 'organization_id' => $placeholderOrg->id]);

    $this->org = Organization::create([
        'name' => 'Test Org',
        'location_id' => $this->location->id,
        'incident_category_id' => $this->category->id,
        'max_active_claims' => 5,
    ]);

    $this->otherOrg = Organization::create([
        'name' => 'Other Org',
        'location_id' => $this->location->id,
        'incident_category_id' => $this->category->id,
        'max_active_claims' => 5,
    ]);

    $this->publicador = User::factory()->create([
        'role_id' => 3,
        'organization_id' => $this->org->id,
    ]);

    $this->otherPublicador = User::factory()->create([
        'role_id' => 3,
        'organization_id' => $this->otherOrg->id,
    ]);

    $reporter = User::factory()->create();

    $this->incident = Incident::create([
        'incident_category_id' => $this->category->id,
        'user_id' => $reporter->id,
        'location_id' => $this->location->id,
        'title' => 'Eligible incident',
        'status' => 'pending',
        'priority' => 'medium',
    ]);

    $this->withoutMiddleware(JwtAuthenticate::class);
});

// ──────────────────────────────────────────────────────────────
// REQ-VRF-01: Listar pendientes
// ──────────────────────────────────────────────────────────────

it('allows a publicador to list pending incidents matching org criteria', function (): void {
    $this->actingAs($this->publicador);

    $response = $this->getJson('/api/incidents/pendientes');

    $response->assertOk();
    $response->assertJsonCount(1, 'data');
    $response->assertJsonPath('data.0.id', $this->incident->id);
});

// ──────────────────────────────────────────────────────────────
// REQ-VRF-02: Confirmar exitoso con auditoría
// ──────────────────────────────────────────────────────────────

it('allows a publicador to confirm an eligible incident', function (): void {
    $this->actingAs($this->publicador);

    $response = $this->postJson("/api/incidents/{$this->incident->id}/confirmar");

    $response->assertOk();
    $response->assertJsonPath('data.organization_id', $this->org->id);
    $response->assertJsonPath('data.status', 'pending_operator');

    $this->assertDatabaseHas('incidents', [
        'id' => $this->incident->id,
        'organization_id' => $this->org->id,
        'status' => 'pending_operator',
    ]);

    $this->assertDatabaseHas('incident_verifications', [
        'incident_id' => $this->incident->id,
        'verified_by' => $this->publicador->id,
        'organization_id' => $this->org->id,
    ]);
});

// ──────────────────────────────────────────────────────────────
// REQ-VRF-02: Confirmación con categoría incorrecta → 403
// ──────────────────────────────────────────────────────────────

it('rejects confirmation if incident category does not match publicador org category', function (): void {
    $reporter = User::factory()->create();
    $wrongIncident = Incident::create([
        'incident_category_id' => $this->otherCategory->id,
        'user_id' => $reporter->id,
        'location_id' => $this->location->id,
        'title' => 'Wrong category incident',
        'status' => 'pending',
        'priority' => 'medium',
    ]);

    $this->actingAs($this->publicador);

    $response = $this->postJson("/api/incidents/{$wrongIncident->id}/confirmar");

    $response->assertStatus(403);
});

// ──────────────────────────────────────────────────────────────
// REQ-VRF-02: Carrera de confirmación (Verification race)
// ──────────────────────────────────────────────────────────────

it('handles confirmation race: first gets 200, second gets 409', function (): void {
    // 1st publisher confirms
    $this->actingAs($this->publicador);
    $response1 = $this->postJson("/api/incidents/{$this->incident->id}/confirmar");
    $response1->assertOk();

    // 2nd publisher tries to confirm the same incident
    $this->actingAs($this->otherPublicador);
    $response2 = $this->postJson("/api/incidents/{$this->incident->id}/confirmar");
    $response2->assertStatus(409);
});
