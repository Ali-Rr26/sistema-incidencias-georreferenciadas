<?php

declare(strict_types=1);

use App\Domains\Incidents\Models\FeedService;
use Illuminate\Support\Facades\Redis;

it('returns empty feed when Redis has no incidents', function (): void {
    $mock = Mockery::mock('alias:'.Redis::class);
    $mock->shouldReceive('zrevrange')
        ->with('feed:incidents', 0, 499)
        ->andReturn([]);

    $service = new FeedService;
    $result = $service->getFeed();

    expect($result['data'])->toBeEmpty()
        ->and($result['meta']['total'])->toBe(0)
        ->and($result['meta']['current_page'])->toBe(1);
});

it('fetches and parses incidents from Redis', function (): void {
    $mock = Mockery::mock('alias:'.Redis::class);
    $mock->shouldReceive('zrevrange')
        ->with('feed:incidents', 0, 499)
        ->andReturn(['1', '2']);

    $mock->shouldReceive('hgetall')
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
            'organization_name' => 'Org A',
            'location_name' => 'Quito',
            'location_path_ids' => '[1,10,100]',
            'user_first_name' => 'Juan',
            'user_last_name' => 'Pérez',
            'user_avatar' => null,
        ]);

    $mock->shouldReceive('hgetall')
        ->with('incident:2')
        ->andReturn([
            'id' => '2',
            'incident_category_id' => '20',
            'organization_id' => '5',
            'user_id' => '4',
            'location_id' => '200',
            'status' => 'in_progress',
            'priority' => 'medium',
            'resolution_date' => null,
            'created_at' => '2026-06-25T08:00:00+00:00',
            'updated_at' => '2026-06-25T08:30:00+00:00',
            'geom' => null,
            'category_name' => 'Robo',
            'organization_name' => 'Org A',
            'location_name' => 'Guayaquil',
            'location_path_ids' => '[1,20,200]',
            'user_first_name' => 'María',
            'user_last_name' => 'Gómez',
            'user_avatar' => null,
        ]);

    $service = new FeedService;
    $result = $service->getFeed();

    expect($result['data'])->toHaveCount(2);
    expect($result['meta'])->toMatchArray([
        'total' => 2,
        'per_page' => 12,
        'current_page' => 1,
        'last_page' => 1,
    ]);
    expect($result['data'][0]['id'])->toBe(1);
    expect($result['data'][0]['status'])->toBe('pending');
    expect($result['data'][0]['category']['name'])->toBe('Accidente');
    expect($result['data'][0]['user']['first_name'])->toBe('Juan');
    expect($result['data'][1]['id'])->toBe(2);
});

it('filters incidents by status', function (): void {
    $mock = Mockery::mock('alias:'.Redis::class);
    $mock->shouldReceive('zrevrange')
        ->with('feed:incidents', 0, 499)
        ->andReturn(['1', '2', '3']);

    $hashData = [
        'id' => '1',
        'incident_category_id' => '10',
        'organization_id' => '5',
        'user_id' => '3',
        'location_id' => '100',
        'status' => 'pending',
        'priority' => 'high',
        'created_at' => '2026-06-26T10:00:00+00:00',
        'updated_at' => '2026-06-26T10:00:00+00:00',
        'category_name' => 'Accidente',
        'organization_name' => 'Org A',
        'location_name' => 'Quito',
        'location_path_ids' => '[1,10,100]',
        'user_first_name' => 'Juan',
        'user_last_name' => 'Pérez',
    ];

    $mock->shouldReceive('hgetall')
        ->with('incident:1')
        ->andReturn(array_merge($hashData, ['status' => 'pending']));

    $mock->shouldReceive('hgetall')
        ->with('incident:2')
        ->andReturn(array_merge($hashData, ['id' => '2', 'status' => 'resolved']));

    $mock->shouldReceive('hgetall')
        ->with('incident:3')
        ->andReturn(array_merge($hashData, ['id' => '3', 'status' => 'pending']));

    $service = new FeedService;
    $result = $service->getFeed(status: 'pending');

    expect($result['data'])->toHaveCount(2);
    expect($result['data'][0]['id'])->toBe(1);
    expect($result['data'][1]['id'])->toBe(3);
});

it('filters incidents by organization_id', function (): void {
    $mock = Mockery::mock('alias:'.Redis::class);
    $mock->shouldReceive('zrevrange')
        ->with('feed:incidents', 0, 499)
        ->andReturn(['1', '2']);

    $baseData = [
        'id' => '1',
        'incident_category_id' => '10',
        'organization_id' => '5',
        'user_id' => '3',
        'location_id' => '100',
        'status' => 'pending',
        'priority' => 'high',
        'created_at' => '2026-06-26T10:00:00+00:00',
        'updated_at' => '2026-06-26T10:00:00+00:00',
        'category_name' => 'Accidente',
        'organization_name' => 'Org A',
        'location_name' => 'Quito',
        'location_path_ids' => '[]',
        'user_first_name' => 'Juan',
        'user_last_name' => 'Pérez',
    ];

    $mock->shouldReceive('hgetall')
        ->with('incident:1')
        ->andReturn(array_merge($baseData, ['organization_id' => '5']));

    $mock->shouldReceive('hgetall')
        ->with('incident:2')
        ->andReturn(array_merge($baseData, ['id' => '2', 'organization_id' => '10']));

    $service = new FeedService;
    $result = $service->getFeed(organizationId: 5);

    expect($result['data'])->toHaveCount(1);
    expect($result['data'][0]['id'])->toBe(1);
});

it('filters incidents by location_id via location_path_ids', function (): void {
    $mock = Mockery::mock('alias:'.Redis::class);
    $mock->shouldReceive('zrevrange')
        ->with('feed:incidents', 0, 499)
        ->andReturn(['1', '2']);

    $baseData = [
        'id' => '1',
        'incident_category_id' => '10',
        'organization_id' => '5',
        'user_id' => '3',
        'location_id' => '100',
        'status' => 'pending',
        'priority' => 'high',
        'created_at' => '2026-06-26T10:00:00+00:00',
        'updated_at' => '2026-06-26T10:00:00+00:00',
        'category_name' => 'Accidente',
        'organization_name' => 'Org A',
        'location_name' => 'Quito',
        'user_first_name' => 'Juan',
        'user_last_name' => 'Pérez',
    ];

    // incident:1 has location_path_ids containing 999 (match)
    $mock->shouldReceive('hgetall')
        ->with('incident:1')
        ->andReturn(array_merge($baseData, ['location_path_ids' => '[1,10,100,999]']));

    // incident:2 does not contain 999 (no match)
    $mock->shouldReceive('hgetall')
        ->with('incident:2')
        ->andReturn(array_merge($baseData, ['id' => '2', 'location_path_ids' => '[1,20,200]']));

    $service = new FeedService;
    $result = $service->getFeed(locationId: 999);

    expect($result['data'])->toHaveCount(1);
    expect($result['data'][0]['id'])->toBe(1);
});

it('paginates results correctly', function (): void {
    $mock = Mockery::mock('alias:'.Redis::class);
    $mock->shouldReceive('zrevrange')
        ->with('feed:incidents', 0, 499)
        ->andReturn(['1', '2', '3', '4', '5']);

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
        'category_name' => 'Accidente',
        'organization_name' => 'Org A',
        'location_name' => 'Quito',
        'location_path_ids' => '[]',
        'user_first_name' => 'Juan',
        'user_last_name' => 'Pérez',
    ];

    foreach (range(1, 5) as $id) {
        $mock->shouldReceive('hgetall')
            ->with("incident:{$id}")
            ->andReturn(array_merge($baseData, ['id' => (string) $id]));
    }

    $service = new FeedService;
    $result = $service->getFeed(page: 2, perPage: 2);

    expect($result['data'])->toHaveCount(2)
        ->and($result['meta'])->toMatchArray([
            'current_page' => 2,
            'per_page' => 2,
            'total' => 5,
            'last_page' => 3,
            'from' => 3,
            'to' => 4,
        ]);

    // Page 2 should have items 3 and 4 (0-indexed: 2, 3)
    expect($result['data'][0]['id'])->toBe(3);
    expect($result['data'][1]['id'])->toBe(4);
});
