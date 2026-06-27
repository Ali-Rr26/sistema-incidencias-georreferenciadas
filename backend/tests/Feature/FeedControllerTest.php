<?php

declare(strict_types=1);

use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\FeedService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Redis;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->redis = Mockery::mock('alias:' . Redis::class);
});

it('returns feed from Redis with correct JSON structure', function (): void {
    $this->redis->shouldReceive('zrevrange')
        ->with('feed:incidents', 0, 499)
        ->andReturn(['1']);

    $this->redis->shouldReceive('hgetall')
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
            'category_organizations' => '[{"id":1,"name":"Bomberos"}]',
            'organization_name' => 'Defensa Civil',
            'location_name' => 'Quito',
            'location_path_ids' => '[1,10,100]',
            'user_first_name' => 'Juan',
            'user_last_name' => 'Pérez',
            'user_avatar' => null,
        ]);

    $response = $this->getJson('/api/incidents/feed');

    $response->assertOk();
    $response->assertJsonStructure([
        'data' => [
            '*' => [
                'id',
                'status',
                'priority',
                'category' => ['id', 'name', 'organizations'],
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
    $this->redis->shouldReceive('zrevrange')
        ->with('feed:incidents', 0, 499)
        ->andThrow(new \RuntimeException('Redis connection refused'));

    // No incidents in DB → empty response from PG fallback
    $response = $this->getJson('/api/incidents/feed');

    $response->assertOk();
    $response->assertJsonPath('data', []);
    $response->assertJsonPath('meta.total', 0);
});

it('applies status filter when reading from Redis', function (): void {
    $this->redis->shouldReceive('zrevrange')
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
        'category_organizations' => '[]',
        'organization_name' => 'Org',
        'location_name' => 'Loc',
        'location_path_ids' => '[]',
        'user_first_name' => 'A',
        'user_last_name' => 'B',
        'user_avatar' => null,
    ];

    $this->redis->shouldReceive('hgetall')
        ->with('incident:1')
        ->andReturn(array_merge($baseData, ['id' => '1', 'status' => 'pending']));

    $this->redis->shouldReceive('hgetall')
        ->with('incident:2')
        ->andReturn(array_merge($baseData, ['id' => '2', 'status' => 'resolved']));

    $response = $this->getJson('/api/incidents/feed?status=pending');

    $response->assertOk();
    $response->assertJsonPath('meta.total', 1);
    $response->assertJsonPath('data.0.id', 1);
});
