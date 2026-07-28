<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Http\Policies\NotificationPolicy;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

/**
 * WU3 (PR-1c) — NotificationPolicy keeps only "who" logic.
 *
 * The policy is now strictly an authorization layer: who is allowed to call
 * approve/reject. The state invariants (status resolved, no prior decision,
 * not expired, right type) moved to `IncidentApprovalService::decide()` in
 * PR-1b. These tests pin the contract at the three organizational layers:
 *
 *   1. admin_sistema: always allowed (matches the Gate::before bypass).
 *   2. admin_organizacion: allowed only when the actor's org matches the
 *      incident's organization_id.
 *   3. admin_organizacion from a different org: denied.
 *   4. non-admin (operador_organizacion, usuario): denied.
 *
 * Note: the policy does NOT check notification type, `data->decision`, or
 * `data->expires_at` anymore. Operators that depend on those checks (e.g. a
 * comment notification being routed through `approve`) surface as 409/410
 * from the service, not as 403 from the policy. The intent is the policy
 * says "yes you can decide"; the service says "but this isn't ready".
 */
beforeEach(function (): void {
    // `Role::$fillable = ['name']` excludes `id`, so we use the query
    // builder to pin the id (mirrors the existing convention across
    // NotificationControllerTest and AssignmentPolicyTest).
    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema', 'created_at' => now(), 'updated_at' => now()],
        ['id' => 3, 'name' => 'admin_organizacion', 'created_at' => now(), 'updated_at' => now()],
        ['id' => 4, 'name' => 'operador_organizacion', 'created_at' => now(), 'updated_at' => now()],
        ['id' => 5, 'name' => 'usuario', 'created_at' => now(), 'updated_at' => now()],
    ]);

    $location = Location::create(['name' => 'Test City', 'level' => 'city']);

    $this->orgA = Organization::create([
        'name' => 'Org A',
        'location_id' => $location->id,
        'max_active_claims' => 5,
    ]);
    $this->orgB = Organization::create([
        'name' => 'Org B',
        'location_id' => $location->id,
        'max_active_claims' => 5,
    ]);

    $category = IncidentCategory::create([
        'name' => 'General',
        'organization_id' => $this->orgA->id,
    ]);

    $this->incident = Incident::create([
        'incident_category_id' => $category->id,
        'user_id' => User::factory()->create(['role_id' => 5])->id,
        'location_id' => $location->id,
        'title' => 'Test incident',
        'description' => 'Test description',
        'status' => 'resolved',
        'priority' => 'medium',
        'organization_id' => $this->orgA->id,
    ]);

    $this->notification = Notification::create([
        'user_id' => User::factory()->create(['role_id' => 1])->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::IncidenciaAtendidaParaAprobacion->value,
        'message' => 'Aprobar',
        'data' => [],
        'read' => false,
    ]);

    $this->policy = new NotificationPolicy;
});

// ─── approve ─────────────────────────────────────────────────────────────────

it('allows admin_sistema to approve regardless of incident org', function (): void {
    $systemAdmin = User::factory()->create([
        'role_id' => 1,
        'organization_id' => null,
    ]);

    expect($this->policy->approve($systemAdmin, $this->notification))->toBeTrue();
});

it('allows admin_organizacion to approve when the incident belongs to their org', function (): void {
    $orgAdmin = User::factory()->create([
        'role_id' => 3,
        'organization_id' => $this->orgA->id,
    ]);

    expect($this->policy->approve($orgAdmin, $this->notification))->toBeTrue();
});

it('denies admin_organizacion from a different org from approving', function (): void {
    $otherOrgAdmin = User::factory()->create([
        'role_id' => 3,
        'organization_id' => $this->orgB->id,
    ]);

    expect($this->policy->approve($otherOrgAdmin, $this->notification))->toBeFalse();
});

it('denies operador_organizacion from approving', function (): void {
    $operator = User::factory()->create([
        'role_id' => 4,
        'organization_id' => $this->orgA->id,
    ]);

    expect($this->policy->approve($operator, $this->notification))->toBeFalse();
});

it('denies a regular citizen from approving', function (): void {
    $citizen = User::factory()->create([
        'role_id' => 5,
        'organization_id' => null,
    ]);

    expect($this->policy->approve($citizen, $this->notification))->toBeFalse();
});

// ─── reject ──────────────────────────────────────────────────────────────────

it('allows admin_sistema to reject', function (): void {
    $systemAdmin = User::factory()->create([
        'role_id' => 1,
        'organization_id' => null,
    ]);

    expect($this->policy->reject($systemAdmin, $this->notification))->toBeTrue();
});

it('allows admin_organizacion to reject when their org matches the incident', function (): void {
    $orgAdmin = User::factory()->create([
        'role_id' => 3,
        'organization_id' => $this->orgA->id,
    ]);

    expect($this->policy->reject($orgAdmin, $this->notification))->toBeTrue();
});

it('denies admin_organizacion from a different org from rejecting', function (): void {
    $otherOrgAdmin = User::factory()->create([
        'role_id' => 3,
        'organization_id' => $this->orgB->id,
    ]);

    expect($this->policy->reject($otherOrgAdmin, $this->notification))->toBeFalse();
});

it('denies operador_organizacion from rejecting', function (): void {
    $operator = User::factory()->create([
        'role_id' => 4,
        'organization_id' => $this->orgA->id,
    ]);

    expect($this->policy->reject($operator, $this->notification))->toBeFalse();
});

// ─── state invariants (type/decision/expires) are NOT in the policy anymore ──

it('does not check notification type at the policy layer', function (): void {
    // A Comment notification would have been 403 in the old policy. With the
    // new "who-only" policy, the answer is purely administrative: an admin
    // from the right org passes; the service then surfaces the wrong-type
    // problem (or any unrelated-type issue) as a 409.
    $commentNotification = Notification::create([
        'user_id' => $this->notification->user_id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Comment->value,
        'message' => 'un comentario',
        'data' => [],
        'read' => false,
    ]);

    $systemAdmin = User::factory()->create([
        'role_id' => 1,
        'organization_id' => null,
    ]);

    expect($this->policy->approve($systemAdmin, $commentNotification))->toBeTrue();
});

it('does not check for a prior decision at the policy layer', function (): void {
    // The old policy returned false once `data->decision` was set. The new
    // policy leaves that to the service (a 409 from `decide()`).
    $this->notification->update([
        'data' => ['decision' => 'approved', 'decided_at' => now()->toIso8601String()],
    ]);

    $systemAdmin = User::factory()->create([
        'role_id' => 1,
        'organization_id' => null,
    ]);

    expect($this->policy->approve($systemAdmin, $this->notification->fresh()))->toBeTrue();
});

it('does not check `data->expires_at` at the policy layer', function (): void {
    // The old policy returned false when `expires_at` had passed. The new
    // policy leaves that to the service (a 410 from `decide()`).
    $this->notification->update([
        'data' => ['expires_at' => now()->subDay()->toIso8601String()],
    ]);

    $systemAdmin = User::factory()->create([
        'role_id' => 1,
        'organization_id' => null,
    ]);

    expect($this->policy->approve($systemAdmin, $this->notification->fresh()))->toBeTrue();
});
