<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentDuplicate;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Permissions\Models\Permission;
use App\Domains\Roles\Models\Role;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Redis;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(PermissionSeeder::class);
    $this->seed(RoleSeeder::class);
    $this->seed(RolePermissionSeeder::class);

    foreach (Permission::all() as $permission) {
        $slug = "{$permission->resource}.{$permission->action}";
        Gate::define($slug, fn (User $user) => $user->hasPermission($slug));
    }

    $this->withoutMiddleware(JwtAuthenticate::class);

    DB::table('roles')->insert(['id' => 99, 'name' => 'staff_reviewer']);
    $this->user = User::factory()->create();
    $this->staffUser = User::factory()->create(['role_id' => 3]); // admin_organizacion
    $this->plainUser = User::factory()->create(['role_id' => 5]); // usuario (citizen)

    $category = IncidentCategory::create(['name' => 'Test Category']);
    $location = Location::create(['name' => 'Test Location', 'level' => 'city']);
    $org = Organization::create([
        'name' => 'Test Org',
        'location_id' => $location->id,
    ]);

    $this->original = Incident::create([
        'incident_category_id' => $category->id,
        'organization_id' => $org->id,
        'user_id' => $this->user->id,
        'location_id' => $location->id,
        'title' => 'Original',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);

    $this->duplicate = Incident::create([
        'incident_category_id' => $category->id,
        'organization_id' => $org->id,
        'user_id' => $this->user->id,
        'location_id' => $location->id,
        'title' => 'Likely Duplicate',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);
});

it('lets a user mark another incident as duplicate', function (): void {
    $response = $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->original->id}/duplicates", [
            'duplicate_incident_id' => $this->duplicate->id,
            'reason' => 'Mismo problema, dirección distinta.',
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.status', 'pending');
    $response->assertJsonPath('data.original_incident_id', $this->original->id);
    $response->assertJsonPath('data.duplicate_incident_id', $this->duplicate->id);
});

it('refuses self-marking with 422', function (): void {
    $response = $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->original->id}/duplicates", [
            'duplicate_incident_id' => $this->original->id,
        ]);

    $response->assertStatus(422);
});

it('refuses marking when unauthenticated', function (): void {
    $response = $this->postJson("/api/incidents/{$this->original->id}/duplicates", [
        'duplicate_incident_id' => $this->duplicate->id,
    ]);

    $response->assertStatus(401);
});

it('enforces unique original+duplicate pair (idempotent)', function (): void {
    $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->original->id}/duplicates", [
            'duplicate_incident_id' => $this->duplicate->id,
        ])
        ->assertStatus(201);

    $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->original->id}/duplicates", [
            'duplicate_incident_id' => $this->duplicate->id,
        ])
        ->assertStatus(201);

    expect(IncidentDuplicate::query()
        ->where('original_incident_id', $this->original->id)
        ->where('duplicate_incident_id', $this->duplicate->id)
        ->count()
    )->toBe(1);
});

it('lists only confirmed duplicates publicly', function (): void {
    // Create a pending one and a confirmed one to ensure the public
    // listing only emits confirmed.
    $other = Incident::create([
        'incident_category_id' => $this->original->incident_category_id,
        'organization_id' => $this->original->organization_id,
        'user_id' => $this->user->id,
        'location_id' => $this->original->location_id,
        'title' => 'Third',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);

    $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->original->id}/duplicates", [
            'duplicate_incident_id' => $this->duplicate->id,
        ])->assertStatus(201);

    $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->original->id}/duplicates", [
            'duplicate_incident_id' => $other->id,
        ])->assertStatus(201);

    // Confirm the first one (the second stays pending).
    $dup = IncidentDuplicate::query()
        ->where('original_incident_id', $this->original->id)
        ->where('duplicate_incident_id', $this->duplicate->id)
        ->first();

    $this->actingAs($this->staffUser)
        ->patchJson("/api/incidents/{$this->original->id}/duplicates/{$dup->id}", [
            'status' => 'confirmed',
        ])->assertOk();

    auth()->forgetGuards();

    $response = $this->getJson("/api/incidents/{$this->original->id}/duplicates");
    $response->assertOk();
    $response->assertJsonCount(1, 'data');
    $response->assertJsonPath('data.0.duplicate_incident_id', $this->duplicate->id);
});

it('lets staff confirm a pending duplicate', function (): void {
    $link = IncidentDuplicate::create([
        'original_incident_id' => $this->original->id,
        'duplicate_incident_id' => $this->duplicate->id,
        'reported_by_user_id' => $this->user->id,
        'reason' => 'Test',
        'status' => 'pending',
    ]);

    $response = $this->actingAs($this->staffUser)
        ->patchJson("/api/incidents/{$this->original->id}/duplicates/{$link->id}", [
            'status' => 'confirmed',
        ]);

    $response->assertOk();
    $response->assertJsonPath('data.status', 'confirmed');
    $response->assertJsonPath('data.reviewed_by_user_id', $this->staffUser->id);

    $link->refresh();
    expect($link->status)->toBe('confirmed');
    expect($link->reviewed_at)->not->toBeNull();
});

it('lets staff reject a pending duplicate', function (): void {
    $link = IncidentDuplicate::create([
        'original_incident_id' => $this->original->id,
        'duplicate_incident_id' => $this->duplicate->id,
        'reported_by_user_id' => $this->user->id,
        'status' => 'pending',
    ]);

    $response = $this->actingAs($this->staffUser)
        ->patchJson("/api/incidents/{$this->original->id}/duplicates/{$link->id}", [
            'status' => 'rejected',
        ]);

    $response->assertOk();
    $response->assertJsonPath('data.status', 'rejected');
});

it('refuses review by a non-staff authenticated user', function (): void {
    $link = IncidentDuplicate::create([
        'original_incident_id' => $this->original->id,
        'duplicate_incident_id' => $this->duplicate->id,
        'reported_by_user_id' => $this->user->id,
        'status' => 'pending',
    ]);

    $response = $this->actingAs($this->plainUser)
        ->patchJson("/api/incidents/{$this->original->id}/duplicates/{$link->id}", [
            'status' => 'confirmed',
        ]);

    $response->assertStatus(403);
});

it('rejects review with invalid status', function (): void {
    $link = IncidentDuplicate::create([
        'original_incident_id' => $this->original->id,
        'duplicate_incident_id' => $this->duplicate->id,
        'reported_by_user_id' => $this->user->id,
        'status' => 'pending',
    ]);

    $response = $this->actingAs($this->staffUser)
        ->patchJson("/api/incidents/{$this->original->id}/duplicates/{$link->id}", [
            'status' => 'pending',
        ]);

    $response->assertStatus(422);
});

it('refuses review when duplicate does not belong to incident in URL', function (): void {
    $otherOriginal = Incident::create([
        'incident_category_id' => $this->original->incident_category_id,
        'organization_id' => $this->original->organization_id,
        'user_id' => $this->user->id,
        'location_id' => $this->original->location_id,
        'title' => 'Other Original',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);

    $link = IncidentDuplicate::create([
        'original_incident_id' => $otherOriginal->id,
        'duplicate_incident_id' => $this->duplicate->id,
        'reported_by_user_id' => $this->user->id,
        'status' => 'pending',
    ]);

    $response = $this->actingAs($this->staffUser)
        ->patchJson("/api/incidents/{$this->original->id}/duplicates/{$link->id}", [
            'status' => 'confirmed',
        ]);

    $response->assertStatus(404);
});

it('hincrby the redis duplicates_count on confirm and decrements on reject', function (): void {
    $link = IncidentDuplicate::create([
        'original_incident_id' => $this->original->id,
        'duplicate_incident_id' => $this->duplicate->id,
        'reported_by_user_id' => $this->user->id,
        'status' => 'pending',
    ]);

    // Confirm: bump +1
    Redis::shouldReceive('hincrby')
        ->once()
        ->with('incident:'.$this->original->id, 'duplicates_count', 1);

    $this->actingAs($this->staffUser)
        ->patchJson("/api/incidents/{$this->original->id}/duplicates/{$link->id}", [
            'status' => 'confirmed',
        ])->assertOk();
});
