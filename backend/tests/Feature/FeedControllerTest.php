<?php

declare(strict_types=1);

use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

uses(RefreshDatabase::class);

// The anonymous "Visitante" role was retired — /api/incidents/feed now
// requires auth for everyone (docs/Requisitos/SRS.md RF-SW-008). FeedController
// branches by role: `usuario` (citizen) still gets this Redis-backed path,
// which is what these tests exercise, so every request here authenticates
// as a `usuario`-role user instead of hitting the endpoint anonymously.
beforeEach(function (): void {
    if (! class_exists('Redis')) {
        $this->markTestSkipped('Redis extension is required for this test.');
    }

    DB::table('roles')->insert(['id' => 5, 'name' => 'usuario']);
    $this->citizen = User::factory()->create(['role_id' => 5]);

    // Seed the permissions catalog so policy lookups work, then grant
    // feed.view to usuario (role 5) — needed by the FeedController
    // citizen-path check.
    $this->seed(\Database\Seeders\PermissionSeeder::class);
    $permId = \App\Domains\Permissions\Models\Permission::where('resource', 'feed')
        ->where('action', 'view')->value('permission_id');
    DB::table('role_permission')->insert([
        'role_id' => 5,
        'permission_id' => $permId,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    // Re-register dynamic gates after seeding (AppServiceProvider ran on
    // empty DB at boot, so feed.view gate doesn't exist yet).
    foreach (\App\Domains\Permissions\Models\Permission::all() as $p) {
        \Illuminate\Support\Facades\Gate::define(
            "{$p->resource}.{$p->action}",
            fn (\App\Domains\Users\Models\User $user) => $user->hasPermission("{$p->resource}.{$p->action}"),
        );
    }

    // Skip JWT middleware — actingAs() bypasses the Auth guard but not
    // the custom JwtAuthenticate middleware, which still rejects the
    // request with 401 before the controller runs. Same seam used by
    // CommentControllerTest and ClaimFlowTest.
    $this->withoutMiddleware(JwtAuthenticate::class);
});

it('returns feed from Redis with correct JSON structure', function (): void {
    Redis::shouldReceive('zrevrange')
        ->with('feed:v2:index', 0, 499)
        ->andReturn(['1']);

    Redis::shouldReceive('hgetall')
        ->with('feed:v2:items')
        ->andReturn([
            '1' => json_encode([
                'id' => '1',
                'incident_category_id' => '10',
                'organization_id' => '5',
                'user_id' => '3',
                'location_id' => '100',
                'status' => 'pending',
                'priority' => 'high',
                'resolution_date' => null,
                'created_at' => '2026-06-26T10:00:00+00:00',
                'updated_at' => '2026-06-26T10:00:00+00:00',
                'geom' => '{"type":"Point","coordinates":[-78.5,-1.2]}',
                'category_name' => 'Accidente',
                'organization_name' => 'Defensa Civil',
                'location_name' => 'Quito',
                'location_path_ids' => '[1,10,100]',
                'user_first_name' => 'Juan',
                'user_last_name' => 'Pérez',
                'user_avatar' => null,
            ]),
        ]);

    $response = $this->actingAs($this->citizen)->getJson('/api/incidents/feed');

    $response->assertOk();
    $response->assertJsonStructure([
        'data' => [
            '*' => [
                'id',
                'status',
                'priority',
                'category' => ['id', 'name'],
                'user' => ['id', 'first_name', 'last_name', 'avatar'],
                'location' => ['id', 'name'],
                'geom',
            ],
        ],
        'meta' => ['current_page', 'per_page', 'total', 'last_page', 'from', 'to'],
    ]);
    $response->assertJsonPath('data.0.id', 1);
    $response->assertJsonPath('data.0.status', 'pending');
    $response->assertJsonPath('data.0.category.name', 'Accidente');
    $response->assertJsonPath('data.0.user.first_name', 'Juan');
    $response->assertJsonPath('meta.total', 1);
});

it('returns empty feed when Redis throws an exception', function (): void {
    Redis::shouldReceive('zrevrange')
        ->with('feed:v2:index', 0, 499)
        ->andThrow(new RuntimeException('Redis connection refused'));

    // FeedService catches Redis exceptions and returns an empty response
    $response = $this->actingAs($this->citizen)->getJson('/api/incidents/feed');

    $response->assertOk();
    $response->assertJsonPath('data', []);
    $response->assertJsonPath('meta.total', 0);
});

it('applies status filter when reading from Redis', function (): void {
    Redis::shouldReceive('zrevrange')
        ->with('feed:v2:index', 0, 499)
        ->andReturn(['1', '2']);

    $baseData = [
        'id' => '0',
        'incident_category_id' => '10',
        'organization_id' => '5',
        'user_id' => '3',
        'location_id' => '100',
        'status' => 'pending',
        'priority' => 'high',
        'created_at' => '2026-06-26T10:00:00+00:00',
        'updated_at' => '2026-06-26T10:00:00+00:00',
        'category_name' => 'Cat',
        'organization_name' => 'Org',
        'location_name' => 'Loc',
        'location_path_ids' => '[]',
        'user_first_name' => 'A',
        'user_last_name' => 'B',
        'user_avatar' => null,
    ];

    Redis::shouldReceive('hgetall')
        ->with('feed:v2:items')
        ->andReturn([
            '1' => json_encode(array_merge($baseData, ['id' => '1', 'status' => 'pending'])),
            '2' => json_encode(array_merge($baseData, ['id' => '2', 'status' => 'resolved'])),
        ]);

    $response = $this->actingAs($this->citizen)->getJson('/api/incidents/feed?status=pending');

    $response->assertOk();
    $response->assertJsonPath('meta.total', 1);
    $response->assertJsonPath('data.0.id', 1);
});
