<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentVerification;
use App\Domains\Incidents\Services\IncidentVerificationService;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    // 1. Roles — use DB::insert since id is guarded in the model
    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'Admin'],
        ['id' => 3, 'name' => 'publicador'],
    ]);

    // 2. Locations (tree: Province > City, and another area)
    $this->provinceLocation = Location::create(['name' => 'Test Province', 'level' => 'province']);
    $this->cityLocation = Location::create([
        'name' => 'Test City',
        'level' => 'city',
        'parent_id' => $this->provinceLocation->id,
    ]);
    $this->otherLocation = Location::create(['name' => 'Other Area', 'level' => 'city']);

    // 3. Categories (no organization_id column — it was removed by normalization)
    $this->matchingCategory = IncidentCategory::create(['name' => 'Accidents']);
    $this->otherCategory = IncidentCategory::create(['name' => 'Fires']);

    // 4. Organization with matching category and parent location
    $this->org = Organization::create([
        'name' => 'Org for Verification',
        'location_id' => $this->provinceLocation->id,
        'incident_category_id' => $this->matchingCategory->id,
        'max_active_claims' => 5,
    ]);

    // 5. Publicador
    $this->publicador = User::factory()->create([
        'role_id' => 3,
        'organization_id' => $this->org->id,
    ]);

    // 6. Reporter
    $reporter = User::factory()->create();

    // 7. Incidents
    $this->eligibleIncident = Incident::create([
        'incident_category_id' => $this->matchingCategory->id,
        'user_id' => $reporter->id,
        'location_id' => $this->cityLocation->id,
        'title' => 'Eligible incident for verification',
        'status' => 'pending',
        'priority' => 'medium',
    ]);

    // Wrong category
    Incident::create([
        'incident_category_id' => $this->otherCategory->id,
        'user_id' => $reporter->id,
        'location_id' => $this->cityLocation->id,
        'title' => 'Wrong category incident',
        'status' => 'pending',
        'priority' => 'medium',
    ]);

    // Out of area
    Incident::create([
        'incident_category_id' => $this->matchingCategory->id,
        'user_id' => $reporter->id,
        'location_id' => $this->otherLocation->id,
        'title' => 'Out of area incident',
        'status' => 'pending',
        'priority' => 'medium',
    ]);

    // Already assigned
    Incident::create([
        'incident_category_id' => $this->matchingCategory->id,
        'user_id' => $reporter->id,
        'location_id' => $this->cityLocation->id,
        'title' => 'Already assigned incident',
        'status' => 'pending',
        'priority' => 'medium',
        'organization_id' => $this->org->id,
    ]);

    $this->service = new IncidentVerificationService;
});

// ──────────────────────────────────────────────────────────────
// REQ-VRF-01: getPendingIncidents filtra por categoría correcta
// ──────────────────────────────────────────────────────────────

it('filters pending incidents by matching category', function (): void {
    $results = $this->service->getPendingIncidents($this->publicador);

    expect($results)->toHaveCount(1);
    expect($results->first()->title)->toBe('Eligible incident for verification');
});

// ──────────────────────────────────────────────────────────────
// REQ-VRF-01: getPendingIncidents filtra por ubicación (subárbol)
// ──────────────────────────────────────────────────────────────

it('filters pending incidents by location subtree', function (): void {
    $results = $this->service->getPendingIncidents($this->publicador);

    expect($results)->toHaveCount(1);
    expect($results->first()->location_id)->toBe($this->cityLocation->id);
});

// ──────────────────────────────────────────────────────────────
// REQ-VRF-01: Publicador sin org config → vacío
// ──────────────────────────────────────────────────────────────

it('returns empty collection when publicador has no org configuration', function (): void {
    $badPublicador = User::factory()->create(['role_id' => 3]);

    $results = $this->service->getPendingIncidents($badPublicador);

    expect($results)->toHaveCount(0);
});

// ──────────────────────────────────────────────────────────────
// REQ-VRF-02: Confirmación exitosa con auditoría
// ──────────────────────────────────────────────────────────────

it('confirms an incident and creates audit record', function (): void {
    $result = $this->service->confirm($this->eligibleIncident->id, $this->publicador);

    expect($result->organization_id)->toBe($this->org->id);
    expect($result->status->value)->toBe('pending_operator');

    // Audit record (REQ-VRF-03)
    $verification = IncidentVerification::where('incident_id', $this->eligibleIncident->id)->first();
    expect($verification)->not->toBeNull();
    expect($verification->verified_by)->toBe($this->publicador->id);
    expect($verification->organization_id)->toBe($this->org->id);
    expect($verification->verified_at)->not->toBeNull();
});

// ──────────────────────────────────────────────────────────────
// REQ-VRF-02: Confirmación de incidencia ya asignada → 409
// ──────────────────────────────────────────────────────────────

it('throws 409 when confirming an already assigned incident', function (): void {
    $this->service->confirm($this->eligibleIncident->id, $this->publicador);

    expect(fn () => $this->service->confirm($this->eligibleIncident->id, $this->publicador))
        ->toThrow(RuntimeException::class, 'ya fue asignada');
});

// ──────────────────────────────────────────────────────────────
// REQ-VRF-02: Dos Publicadores compiten → uno 200, otro 409
// ──────────────────────────────────────────────────────────────

it('handles competing publishers: first succeeds, second gets 409', function (): void {
    $orgB = Organization::create([
        'name' => 'Org B for Verification',
        'location_id' => $this->provinceLocation->id,
        'incident_category_id' => $this->matchingCategory->id,
        'max_active_claims' => 5,
    ]);
    $pubB = User::factory()->create([
        'role_id' => 3,
        'organization_id' => $orgB->id,
    ]);

    $reporter = User::factory()->create();
    $competingIncident = Incident::create([
        'incident_category_id' => $this->matchingCategory->id,
        'user_id' => $reporter->id,
        'location_id' => $this->cityLocation->id,
        'title' => 'Competing incident',
        'status' => 'pending',
        'priority' => 'medium',
    ]);

    $firstResult = $this->service->confirm($competingIncident->id, $this->publicador);
    expect($firstResult->organization_id)->toBe($this->org->id);

    expect(fn () => $this->service->confirm($competingIncident->id, $pubB))
        ->toThrow(RuntimeException::class, 'ya fue asignada');
});
