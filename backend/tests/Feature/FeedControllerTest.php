<?php

declare(strict_types=1);

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
});

it('returns feed from Redis with correct JSON structure', function (): void {
    Redis::shouldReceive('zrevrange')
        ->with('feed:incidents', 0, 499)
        ->andReturn(['1']);

    Redis::shouldReceive('hgetall')
        ->with('incident:1')
        ->andReturn([
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

it('falls back to PostgreSQL when Redis throws an exception', function (): void {
    Redis::shouldReceive('zrevrange')
        ->with('feed:incidents', 0, 499)
        ->andThrow(new RuntimeException('Redis connection refused'));

    // No incidents in DB → empty response from PG fallback
    $response = $this->actingAs($this->citizen)->getJson('/api/incidents/feed');

    $response->assertOk();
    $response->assertJsonPath('data', []);
    $response->assertJsonPath('meta.total', 0);
});

it('applies status filter when reading from Redis', function (): void {
    Redis::shouldReceive('zrevrange')
        ->with('feed:incidents', 0, 499)
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
        ->with('incident:1')
        ->andReturn(array_merge($baseData, ['id' => '1', 'status' => 'pending']));

    Redis::shouldReceive('hgetall')
        ->with('incident:2')
        ->andReturn(array_merge($baseData, ['id' => '2', 'status' => 'resolved']));

    $response = $this->actingAs($this->citizen)->getJson('/api/incidents/feed?status=pending');

    $response->assertOk();
    $response->assertJsonPath('meta.total', 1);
    $response->assertJsonPath('data.0.id', 1);
});
