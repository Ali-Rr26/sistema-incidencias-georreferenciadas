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

it('exposes comments_count in the incident show payload', function (): void {
    Comment::create([
        'incident_id' => $this->incident->id,
        'user_id' => $this->user->id,
        'message' => 'one',
    ]);
    Comment::create([
        'incident_id' => $this->incident->id,
        'user_id' => $this->user->id,
        'message' => 'two',
    ]);

    $response = $this->actingAs($this->user)
        ->getJson("/api/incidents/{$this->incident->id}");

    $response->assertOk();
    $response->assertJsonPath('data.comments_count', 2);
});

it('exposes comments_count in the incident index payload', function (): void {
    foreach (range(1, 3) as $i) {
        Comment::create([
            'incident_id' => $this->incident->id,
            'user_id' => $this->user->id,
            'message' => "c{$i}",
        ]);
    }

    // operator role to hit the staff path that doesn't gate by user_id.
    $staff = User::factory()->create(['role_id' => 2]); // operador_sistema

    $response = $this->actingAs($staff)
        ->getJson('/api/incidents');

    $response->assertOk();
    $response->assertJsonPath('data.0.comments_count', 3);
});

it('exposes me_too_count and viewer_has_me_too in the show payload', function (): void {
    MeTooReport::create([
        'incident_id' => $this->incident->id,
        'user_id' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->getJson("/api/incidents/{$this->incident->id}");

    $response->assertOk();
    $response->assertJsonPath('data.me_too_count', 1);
    $response->assertJsonPath('data.viewer_has_me_too', true);
});

it('exposes followers_count and viewer_is_following in the show payload', function (): void {
    \App\Domains\Incidents\Models\IncidentFollower::create([
        'incident_id' => $this->incident->id,
        'user_id' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->getJson("/api/incidents/{$this->incident->id}");

    $response->assertOk();
    $response->assertJsonPath('data.followers_count', 1);
    $response->assertJsonPath('data.viewer_is_following', true);
});

it('exposes is_duplicate and duplicate_of when the incident is a confirmed duplicate', function (): void {
    $original = Incident::create([
        'incident_category_id' => $this->incident->incident_category_id,
        'organization_id' => $this->incident->organization_id,
        'user_id' => $this->user->id,
        'location_id' => $this->incident->location_id,
        'title' => 'Canonical',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);

    $link = \App\Domains\Incidents\Models\IncidentDuplicate::create([
        'original_incident_id' => $original->id,
        'duplicate_incident_id' => $this->incident->id,
        'reported_by_user_id' => $this->user->id,
        'status' => 'confirmed',
        'reviewed_by_user_id' => $this->user->id,
        'reviewed_at' => now(),
    ]);

    $response = $this->actingAs($this->user)
        ->getJson("/api/incidents/{$this->incident->id}");

    $response->assertOk();
    $response->assertJsonPath('data.is_duplicate', true);
    $response->assertJsonPath('data.duplicate_of.incident_id', $original->id);
    $response->assertJsonPath('data.duplicate_of.title', 'Canonical');
});

it('keeps the redis comment_count consistent after a comment create + soft delete', function (): void {
    $incident = $this->incident;

    // The live path uses Redis::pipeline() inside the Job. The job
    // calls $pipe->hincrby() then $pipe->exec() — mock those and
    // assert the args instead of the static facade call.
    Redis::shouldReceive('pipeline')
        ->twice()
        ->andReturn($pipe = Mockery::mock());

    $pipe->shouldReceive('zadd')->zeroOrMoreTimes();
    $pipe->shouldReceive('hmset')->zeroOrMoreTimes();

    $pipe->shouldReceive('hincrby')
        ->once()
        ->with('incident:'.$incident->id, 'comment_count', 1);

    $pipe->shouldReceive('hincrby')
        ->once()
        ->with('incident:'.$incident->id, 'comment_count', -1);

    $pipe->shouldReceive('zrem')->zeroOrMoreTimes();
    $pipe->shouldReceive('exec')->twice();

    $c = Comment::create([
        'incident_id' => $incident->id,
        'user_id' => $this->user->id,
        'message' => 'live',
    ]);

    $c->delete();
});
