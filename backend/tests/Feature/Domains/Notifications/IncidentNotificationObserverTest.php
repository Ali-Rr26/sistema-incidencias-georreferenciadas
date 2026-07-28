<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

uses(RefreshDatabase::class);

/**
 * WU4 (PR-2) — hybrid admin_sistema scope + actor_name persistence on the
 * `IncidentNotificationObserver::handleAdminApprovalChange` path.
 *
 * ADR-6 (incident-approval-workflow/design.md): admin_sistema with
 * organization_id only sees that org; without org sees globally.
 * ADR-4: the observer persists `data.actor_name` resolved from the user at
 * creation time, so the resource can read it back without an N+1 query.
 *
 * Setup: we seed the four roles that the observer's `whereHas('role')`
 * branches check for, plus a citizen, two orgs, an operator that the
 * incident will attribute the resolution to, and three admins:
 *   - adminInA       (admin_sistema, organization_id = orgA)
 *   - adminInB       (admin_sistema, organization_id = orgB)
 *   - adminGlobal    (admin_sistema, organization_id = null)
 */
beforeEach(function (): void {
    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema'],
        ['id' => 3, 'name' => 'admin_organizacion'],
        ['id' => 4, 'name' => 'operador_organizacion'],
        ['id' => 5, 'name' => 'usuario'],
    ]);

    // Citizen who reported the incident.
    $this->citizen = User::factory()->create([
        'role_id' => 5,
        'first_name' => 'Carla',
        'last_name' => 'Ciudadana',
    ]);

    // Operator that "claimed" and resolved the incident — they are the
    // actor whose full name must be persisted into `data.actor_name`.
    $this->operator = User::factory()->create([
        'role_id' => 4,
        'first_name' => 'Oscar',
        'last_name' => 'Operador',
    ]);

    $location = Location::create(['name' => 'HQ', 'level' => 'city']);

    $this->orgA = Organization::create(['name' => 'Org A', 'location_id' => $location->id]);
    $this->orgB = Organization::create(['name' => 'Org B', 'location_id' => $location->id]);

    $this->category = IncidentCategory::create([
        'name' => 'General',
        'organization_id' => $this->orgA->id,
    ]);

    // admin_sistema anchored to each organization.
    $this->adminInA = User::factory()->create([
        'role_id' => 1,
        'organization_id' => $this->orgA->id,
        'first_name' => 'Ana',
        'last_name' => 'SistemaA',
    ]);
    $this->adminInB = User::factory()->create([
        'role_id' => 1,
        'organization_id' => $this->orgB->id,
        'first_name' => 'Beto',
        'last_name' => 'SistemaB',
    ]);
    // admin_sistema without an organization — receives every incident.
    $this->adminGlobal = User::factory()->create([
        'role_id' => 1,
        'organization_id' => null,
        'first_name' => 'Gala',
        'last_name' => 'Global',
    ]);

    // The observer pushes live updates over Redis Pub/Sub when the
    // NotificationService publishes. We don't care about that channel
    // here, but the publish call goes through `Redis::publish`; mock it
    // so the test doesn't depend on a Redis broker being reachable.
    Redis::shouldReceive('publish')->andReturn(0);
});

// ──────────────────────────────────────────────────────────────────────
// S-1: Hybrid admin_sistema scope on `resolved` transition
// ──────────────────────────────────────────────────────────────────────
it('routes the approval notification by hybrid admin_sistema scope on resolve', function (): void {
    $incident = Incident::create([
        'title' => 'Bache en calle X',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->citizen->id,
        'location_id' => Location::first()->id,
        'organization_id' => $this->orgA->id,
        'status' => 'in_progress',
        'priority' => 'medium',
        'claimed_by' => $this->operator->id,
    ]);

    $incident->update(['status' => IncidentStatus::Resolved->value]);

    // admin_sistema anchored to org A → must receive (org of the incident).
    expect(
        Notification::query()
            ->where('user_id', $this->adminInA->id)
            ->where('type', NotificationType::IncidenciaAtendidaParaAprobacion->value)
            ->exists()
    )->toBeTrue();

    // admin_sistema anchored to org B → must NOT receive (other org).
    expect(
        Notification::query()
            ->where('user_id', $this->adminInB->id)
            ->where('type', NotificationType::IncidenciaAtendidaParaAprobacion->value)
            ->exists()
    )->toBeFalse();

    // admin_sistema without organization → must receive (global).
    expect(
        Notification::query()
            ->where('user_id', $this->adminGlobal->id)
            ->where('type', NotificationType::IncidenciaAtendidaParaAprobacion->value)
            ->exists()
    )->toBeTrue();
});

// ──────────────────────────────────────────────────────────────────────
// S-2: actor_name persisted into `data` at creation time
// ──────────────────────────────────────────────────────────────────────
it('persists the operator full name into the notification data on resolve', function (): void {
    $incident = Incident::create([
        'title' => 'Bache con operador',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->citizen->id,
        'location_id' => Location::first()->id,
        'organization_id' => $this->orgA->id,
        'status' => 'in_progress',
        'priority' => 'medium',
        'claimed_by' => $this->operator->id,
    ]);

    $incident->update(['status' => IncidentStatus::Resolved->value]);

    $notification = Notification::query()
        ->where('user_id', $this->adminInA->id)
        ->where('type', NotificationType::IncidenciaAtendidaParaAprobacion->value)
        ->first();

    expect($notification)->not->toBeNull()
        ->and($notification->data['actor_user_id'])->toBe($this->operator->id)
        ->and($notification->data['actor_name'])->toBe('Oscar Operador');
});
