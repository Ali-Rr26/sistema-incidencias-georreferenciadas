<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentFollower;
use App\Domains\Locations\Models\Location;
use App\Domains\Notifications\Models\Notification;
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
use Illuminate\Support\Facades\Queue;
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

it('lets a user follow an incident and returns 201 with count', function (): void {
    $response = $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->incident->id}/follow");

    $response->assertStatus(201);
    $response->assertJsonPath('data.followers_count', 1);
    $response->assertJsonPath('data.is_following', true);

    expect(IncidentFollower::query()->where('incident_id', $this->incident->id)->count())->toBe(1);
});

it('counts followers from multiple users', function (): void {
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/follow")->assertStatus(201);
    $this->actingAs($this->otherUser)->postJson("/api/incidents/{$this->incident->id}/follow")->assertStatus(201);

    $response = $this->actingAs($this->user)
        ->getJson("/api/incidents/{$this->incident->id}/follow");

    $response->assertOk();
    $response->assertJsonPath('data.followers_count', 2);
});

it('enforces one follow per user per incident (unique constraint)', function (): void {
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/follow")->assertStatus(201);
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/follow")->assertStatus(201);

    expect(IncidentFollower::query()->where('incident_id', $this->incident->id)->count())->toBe(1);
});

it('lets a user unfollow and decrements the count', function (): void {
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/follow")->assertStatus(201);

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/incidents/{$this->incident->id}/follow");

    $response->assertNoContent();
    expect(IncidentFollower::query()->where('incident_id', $this->incident->id)->count())->toBe(0);
});

it('unfollow is a no-op when not following', function (): void {
    $response = $this->actingAs($this->user)
        ->deleteJson("/api/incidents/{$this->incident->id}/follow");

    $response->assertNoContent();
    expect(IncidentFollower::query()->where('incident_id', $this->incident->id)->count())->toBe(0);
});

it('refuses follow when unauthenticated', function (): void {
    $response = $this->postJson("/api/incidents/{$this->incident->id}/follow");
    $response->assertStatus(401);
});

it('returns count + is_following for an authenticated reader', function (): void {
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/follow")->assertStatus(201);
    $this->actingAs($this->otherUser)->postJson("/api/incidents/{$this->incident->id}/follow")->assertStatus(201);

    $response = $this->actingAs($this->user)
        ->getJson("/api/incidents/{$this->incident->id}/follow");

    $response->assertOk();
    $response->assertJsonPath('data.followers_count', 2);
    $response->assertJsonPath('data.is_following', true);
});

it('returns count but no is_following for an anonymous reader', function (): void {
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/follow")->assertStatus(201);

    auth()->forgetGuards();

    $response = $this->getJson("/api/incidents/{$this->incident->id}/follow");

    $response->assertOk();
    $response->assertJsonPath('data.followers_count', 1);
    $response->assertJsonPath('data.is_following', false);
});

it('hincrby the redis followers_count on the live projection', function (): void {
    Redis::shouldReceive('hincrby')
        ->once()
        ->with('incident:'.$this->incident->id, 'followers_count', 1);

    $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->incident->id}/follow")
        ->assertStatus(201);
});

it('dispatches a notification to followers when a comment is posted', function (): void {
    Queue::fake();

    // Two followers, the comment author is also a follower (must be skipped).
    $this->actingAs($this->user)->postJson("/api/incidents/{$this->incident->id}/follow")->assertStatus(201);
    $this->actingAs($this->otherUser)->postJson("/api/incidents/{$this->incident->id}/follow")->assertStatus(201);

    // A third user (not a follower) authors the comment.
    $commenter = User::factory()->create();
    $this->actingAs($commenter)
        ->postJson("/api/incidents/{$this->incident->id}/comments", [
            'message' => 'Atención a esta incidencia.',
        ])
        ->assertStatus(201);

    Queue::assertPushed(\App\Domains\Notifications\Jobs\SendIncidentNotificationJob::class, 2);

    Queue::assertPushed(\App\Domains\Notifications\Jobs\SendIncidentNotificationJob::class, function ($job): bool {
        return (int) $job->userId === (int) $this->user->id;
    });

    Queue::assertPushed(\App\Domains\Notifications\Jobs\SendIncidentNotificationJob::class, function ($job): bool {
        return (int) $job->userId === (int) $this->otherUser->id;
    });

    Queue::assertNotPushed(\App\Domains\Notifications\Jobs\SendIncidentNotificationJob::class, function ($job) use ($commenter): bool {
        return (int) $job->userId === (int) $commenter->id;
    });
});
