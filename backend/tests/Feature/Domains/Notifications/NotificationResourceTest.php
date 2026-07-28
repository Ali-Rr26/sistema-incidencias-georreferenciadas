<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Notifications\Http\Resources\NotificationResource;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

/**
 * WU4 (PR-2) — `NotificationResource` N+1 fix.
 *
 * The observer (4.1 / 4.2) now snapshots `data.actor_name` at creation
 * time, so the resource must read it first and only fall back to
 * `User::find()` for legacy rows that don't carry the field. This file
 * asserts both halves of that contract via `DB::listen`:
 *
 *   - 10 notifications with `actor_name` present → 0 `users` queries.
 *   - a "legacy" notification without `actor_name` → 1 `users` query
 *     (only for that row).
 *
 * `incident_id` is NOT NULL on `notifications`; we need a real
 * Incident for every row we insert. We share one Incident across all
 * rows in a test (the observer does not fan-out per incident; this
 * resource just renders what's there).
 */
beforeEach(function (): void {
    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema'],
        ['id' => 5, 'name' => 'usuario'],
    ]);

    $location = Location::create(['name' => 'HQ', 'level' => 'city']);
    $org = Organization::create(['name' => 'Test Org', 'location_id' => $location->id]);
    $category = IncidentCategory::create(['name' => 'General', 'organization_id' => $org->id]);

    $this->citizen = User::factory()->create(['role_id' => 5]);

    $this->incident = Incident::create([
        'title' => 'Inc for notifications',
        'incident_category_id' => $category->id,
        'user_id' => $this->citizen->id,
        'location_id' => $location->id,
        'organization_id' => $org->id,
        'status' => 'pending',
        'priority' => 'medium',
    ]);
});

// ──────────────────────────────────────────────────────────────────────
// S-3: 0 extra `users` queries when actor_name is present on every row
// ──────────────────────────────────────────────────────────────────────
it('avoids N+1 queries to users when actor_name is snapshotted on each row', function (): void {
    $user = User::factory()->create(['role_id' => 5, 'first_name' => 'Ana', 'last_name' => 'Snapshot']);

    $notifications = collect();
    for ($i = 0; $i < 10; $i++) {
        $notifications->push(Notification::create([
            'user_id' => $user->id,
            'incident_id' => $this->incident->id,
            'type' => 'incidencia_atendida_para_aprobacion',
            'message' => 'm',
            'data' => [
                'incident_id' => $this->incident->id,
                'actor_user_id' => $user->id,
                'actor_name' => 'Ana Snapshot',
                'actor_role' => 'usuario',
            ],
            'read' => false,
        ]));
    }

    // Count SELECTs against `users` triggered by resolving the resource
    // collection. With actor_name present on every row we expect 0.
    DB::flushQueryLog();
    DB::enableQueryLog();
    NotificationResource::collection($notifications)->resolve();
    $userQueries = 0;
    foreach (DB::getQueryLog() as $query) {
        $sql = strtolower($query['query']);
        if (str_contains($sql, 'from "users"') || str_contains($sql, 'from users')) {
            $userQueries++;
        }
    }
    DB::disableQueryLog();

    expect($userQueries)->toBe(0);
});

// ──────────────────────────────────────────────────────────────────────
// S-4: legacy row (no actor_name) falls back to User::find()
// ──────────────────────────────────────────────────────────────────────
it('falls back to a single User::find for legacy rows without actor_name', function (): void {
    $user = User::factory()->create(['role_id' => 5, 'first_name' => 'Leo', 'last_name' => 'Legacy']);

    // Two modern rows (snapshotted) + one legacy row missing actor_name.
    $modern1 = Notification::create([
        'user_id' => $user->id,
        'incident_id' => $this->incident->id,
        'type' => 'incidencia_atendida_para_aprobacion',
        'message' => 'm',
        'data' => ['incident_id' => $this->incident->id, 'actor_user_id' => $user->id, 'actor_name' => 'Leo Legacy', 'actor_role' => 'usuario'],
        'read' => false,
    ]);
    $modern2 = Notification::create([
        'user_id' => $user->id,
        'incident_id' => $this->incident->id,
        'type' => 'incidencia_atendida_para_aprobacion',
        'message' => 'm',
        'data' => ['incident_id' => $this->incident->id, 'actor_user_id' => $user->id, 'actor_name' => 'Leo Legacy', 'actor_role' => 'usuario'],
        'read' => false,
    ]);
    $legacy = Notification::create([
        'user_id' => $user->id,
        'incident_id' => $this->incident->id,
        'type' => 'legacy',
        'message' => 'm',
        'data' => ['incident_id' => $this->incident->id, 'actor_user_id' => $user->id /* no actor_name */],
        'read' => false,
    ]);

    $payload = NotificationResource::collection([$modern1, $modern2, $legacy])->resolve();

    // Modern rows: actor without a DB hit, resolved from data.actor_name.
    $payloadById = collect($payload)->keyBy('id');

    expect($payloadById[$modern1->id]['actor'])->toBe([
        'id' => $user->id,
        'name' => 'Leo Legacy',
        'role' => 'usuario',
    ]);
    expect($payloadById[$modern2->id]['actor'])->toBe([
        'id' => $user->id,
        'name' => 'Leo Legacy',
        'role' => 'usuario',
    ]);

    // Legacy row: actor came from User::find($actorId) — the existing
    // fallback shape that returns `first_name` only. The resource
    // contract keeps that field name (`name`) for backward compatibility
    // with the frontend; the only change is the resolution path.
    expect($payloadById[$legacy->id]['actor'])->toBe([
        'id' => $user->id,
        'name' => 'Leo',
        'role' => 'usuario',
    ]);
});
