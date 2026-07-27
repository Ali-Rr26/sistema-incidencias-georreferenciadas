<?php

declare(strict_types=1);

use App\Domains\Comments\Models\Comment;
use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\MeTooReport;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Permissions\Models\Permission;
use App\Domains\Roles\Models\Role;
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

    $this->user = User::factory()->create();
    $this->otherUser = User::factory()->create();

    $category = IncidentCategory::create(['name' => 'Test Category']);
    $location = Location::create(['name' => 'Test Location', 'level' => 'city']);
    $org = Organization::create([
        'name' => 'Test Org',
        'location_id' => $location->id,
    ]);

    $this->incident = Incident::create([
        'incident_category_id' => $category->id,
        'organization_id' => $org->id,
        'user_id' => $this->user->id,
        'location_id' => $location->id,
        'title' => 'Test Incident',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);
});

it('lets a user me-too an incident and returns 201 with count', function (): void {
    $response = $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->incident->id}/me-too");

    $response->assertStatus(201);
    $response->assertJsonPath('data.me_too_count', 1);
    $response->assertJsonPath('data.viewer_has_me_too', true);

    expect(MeTooReport::query()->where('incident_id', $this->incident->id)->count())->toBe(1);
});

it('counts me-toos from multiple users', function (): void {
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/me-too")->assertStatus(201);
    $this->actingAs($this->otherUser)->postJson("/api/incidents/{$this->incident->id}/me-too")->assertStatus(201);

    $response = $this->actingAs($this->user)
        ->getJson("/api/incidents/{$this->incident->id}/me-too");

    $response->assertOk();
    $response->assertJsonPath('data.me_too_count', 2);
});

it('enforces one me-too per user per incident (unique constraint)', function (): void {
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/me-too")->assertStatus(201);
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/me-too")->assertStatus(201);

    expect(MeTooReport::query()->where('incident_id', $this->incident->id)->count())->toBe(1);
});

it('lets a user remove their me-too and decrements the count', function (): void {
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/me-too")->assertStatus(201);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/incidents/{$this->incident->id}/me-too");

    $response->assertNoContent();
    expect(MeTooReport::query()->where('incident_id', $this->incident->id)->count())->toBe(0);
});

it('remove is a no-op when user never me-too-ed', function (): void {
    $response = $this->actingAs($this->user)
        ->deleteJson("/api/incidents/{$this->incident->id}/me-too");

    $response->assertNoContent();
    expect(MeTooReport::query()->where('incident_id', $this->incident->id)->count())->toBe(0);
});

it('refuses me-too when unauthenticated', function (): void {
    $response = $this->postJson("/api/incidents/{$this->incident->id}/me-too");

    $response->assertStatus(401);
});

it('returns count + viewer flag for an authenticated reader', function (): void {
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/me-too")->assertStatus(201);
    $this->actingAs($this->otherUser)->postJson("/api/incidents/{$this->incident->id}/me-too")->assertStatus(201);

    $response = $this->actingAs($this->user)
        ->getJson("/api/incidents/{$this->incident->id}/me-too");

    $response->assertOk();
    $response->assertJsonPath('data.me_too_count', 2);
    $response->assertJsonPath('data.viewer_has_me_too', true);
});

it('returns count but no viewer flag for an anonymous reader', function (): void {
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/me-too")->assertStatus(201);

    // After the POST above the auth guard has a cached user. Make sure
    // the next request (no actingAs) is genuinely anonymous — Laravel's
    // TestResponse doesn't reset guards between requests in the same
    // test, so we explicitly clear it here.
    auth()->forgetGuards();

    $response = $this->getJson("/api/incidents/{$this->incident->id}/me-too");

    $response->assertOk();
    $response->assertJsonPath('data.me_too_count', 1);
    $response->assertJsonPath('data.viewer_has_me_too', false);
});

it('lists the me-too users with pagination (auth required)', function (): void {
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/me-too")->assertStatus(201);
    $this->actingAs($this->otherUser)->postJson("/api/incidents/{$this->incident->id}/me-too")->assertStatus(201);

    $response = $this->actingAs($this->user)
        ->getJson("/api/incidents/{$this->incident->id}/me-too/users?per_page=10");

    $response->assertOk();
    $response->assertJsonCount(2, 'data');
    $response->assertJsonStructure([
        'data' => [
            '*' => ['id', 'user' => ['id', 'first_name', 'last_name'], 'created_at'],
        ],
        'meta' => ['current_page', 'per_page', 'total', 'last_page'],
    ]);
    $response->assertJsonPath('meta.total', 2);
});

it('refuses the me-too users listing when unauthenticated', function (): void {
    $response = $this->getJson("/api/incidents/{$this->incident->id}/me-too/users");

    $response->assertStatus(401);
});

it('hincrby the redis me_too_count on the live projection', function (): void {
    Redis::shouldReceive('hincrby')
        ->once()
        ->with('incident:'.$this->incident->id, 'me_too_count', 1);

    $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->incident->id}/me-too")
        ->assertStatus(201);
});
