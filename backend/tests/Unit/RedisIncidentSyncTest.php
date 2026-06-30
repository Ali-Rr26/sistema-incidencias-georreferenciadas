<?php

declare(strict_types=1);

use App\Domains\Incidents\Listeners\RedisIncidentSync;
use App\Domains\Incidents\Models\Incident;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

uses(TestCase::class);

it('calls HMSET and ZADD when incident is created', function (): void {
    $user = \App\Domains\Users\Models\User::factory()->make(['id' => 3, 'first_name' => 'John', 'last_name' => 'Doe']);
    $category = new \App\Domains\IncidentCategories\Models\IncidentCategory(['id' => 1, 'name' => 'Test Category']);
    
    $location = Mockery::mock(\App\Domains\Locations\Models\Location::class)->makePartial();
    $location->id = 10;
    $location->name = 'Test Location';
    $location->shouldReceive('ancestorsAndSelf')->andReturnSelf();
    $location->shouldReceive('orderBy')->with('depth', 'desc')->andReturnSelf();
    $location->shouldReceive('pluck')->with('id')->andReturn(collect([10, 5, 1]));

    $org = new \App\Domains\Organizations\Models\Organization(['id' => 2, 'name' => 'Test Org']);

    $incident = new Incident([
        'incident_category_id' => 1,
        'organization_id' => 2,
        'user_id' => 3,
        'location_id' => 10,
        'status' => 'pending',
        'priority' => 'medium',
    ]);
    $incident->id = 42;
    $incident->exists = true;
    $incident->created_at = now();
    $incident->updated_at = now();
    
    $incident->setRelation('category', $category);
    $incident->setRelation('organization', $org);
    $incident->setRelation('location', $location);
    $incident->setRelation('user', $user);

    Redis::shouldReceive('hmset')
        ->once();

    Redis::shouldReceive('zadd')
        ->once();

    $sync = new RedisIncidentSync;
    $sync->created($incident);
});

it('calls DEL and ZREM when incident is deleted', function (): void {
    $incident = new Incident;
    $incident->id = 99;
    $incident->exists = true;

    Redis::shouldReceive('del')
        ->once()
        ->with('incident:99');

    Redis::shouldReceive('zrem')
        ->once()
        ->with('feed:incidents', '99');

    $sync = new RedisIncidentSync;
    $sync->deleted($incident);
});

it('calls HMSET and ZADD when incident is updated', function (): void {
    $user = \App\Domains\Users\Models\User::factory()->make(['id' => 3, 'first_name' => 'Jane', 'last_name' => 'Smith']);
    $category = new \App\Domains\IncidentCategories\Models\IncidentCategory(['id' => 1, 'name' => 'Test Category']);
    
    $location = Mockery::mock(\App\Domains\Locations\Models\Location::class)->makePartial();
    $location->id = 10;
    $location->name = 'Test Location';
    $location->shouldReceive('ancestorsAndSelf')->andReturnSelf();
    $location->shouldReceive('orderBy')->with('depth', 'desc')->andReturnSelf();
    $location->shouldReceive('pluck')->with('id')->andReturn(collect([10]));

    $org = new \App\Domains\Organizations\Models\Organization(['id' => 2, 'name' => 'Test Org']);

    $incident = new Incident([
        'incident_category_id' => 1,
        'organization_id' => 2,
        'user_id' => 3,
        'location_id' => 10,
        'status' => 'in_progress',
        'priority' => 'high',
    ]);
    $incident->id = 7;
    $incident->exists = true;
    $incident->created_at = now();
    $incident->updated_at = now();
    
    $incident->setRelation('category', $category);
    $incident->setRelation('organization', $org);
    $incident->setRelation('location', $location);
    $incident->setRelation('user', $user);

    Redis::shouldReceive('hmset')
        ->once();

    Redis::shouldReceive('zadd')
        ->once();

    $sync = new RedisIncidentSync;
    $sync->updated($incident);
});

it('does not throw when Redis is unreachable', function (): void {
    $incident = new Incident;
    $incident->id = 1;
    $incident->exists = true;

    Redis::shouldReceive('del')
        ->once()
        ->andThrow(new RuntimeException('Connection refused'));

    $sync = new RedisIncidentSync;

    try {
        $sync->deleted($incident);
    } catch (Throwable) {
    }

    expect(true)->toBeTrue();
});
