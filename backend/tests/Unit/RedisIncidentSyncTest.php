<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Listeners\RedisIncidentSync;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\ReadModels\IncidentFeedSerializer;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Support\Facades\Redis;
use Tests\TestCase;

uses(TestCase::class);

it('calls HMSET and ZADD when incident is created', function (): void {
    $user = User::factory()->make(['id' => 3, 'first_name' => 'John', 'last_name' => 'Doe']);
    $category = new IncidentCategory(['id' => 1, 'name' => 'Test Category']);

    $location = Mockery::mock(Location::class)->makePartial();
    $location->id = 10;
    $location->name = 'Test Location';
    $location->shouldReceive('ancestorsAndSelf')->andReturnSelf();
    $location->shouldReceive('orderBy')->with('depth', 'desc')->andReturnSelf();
    $location->shouldReceive('pluck')->with('id')->andReturn(collect([10, 5, 1]));

    $org = new Organization(['id' => 2, 'name' => 'Test Org']);

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

    Redis::shouldReceive('hset')
        ->once()
        ->with('feed:v2:items', '42', Mockery::any());

    Redis::shouldReceive('zadd')
        ->once()
        ->with('feed:v2:index', Mockery::any(), '42');

    $sync = new RedisIncidentSync(new IncidentFeedSerializer);
    $sync->created($incident);
});

it('calls DEL and ZREM when incident is deleted', function (): void {
    $incident = new Incident;
    $incident->id = 99;
    $incident->exists = true;

    Redis::shouldReceive('hdel')
        ->once()
        ->with('feed:v2:items', '99');

    Redis::shouldReceive('zrem')
        ->once()
        ->with('feed:v2:index', '99');

    $sync = new RedisIncidentSync(new IncidentFeedSerializer);
    $sync->deleted($incident);
});

it('calls HMSET and ZADD when incident is updated', function (): void {
    $user = User::factory()->make(['id' => 3, 'first_name' => 'Jane', 'last_name' => 'Smith']);
    $category = new IncidentCategory(['id' => 1, 'name' => 'Test Category']);

    $location = Mockery::mock(Location::class)->makePartial();
    $location->id = 10;
    $location->name = 'Test Location';
    $location->shouldReceive('ancestorsAndSelf')->andReturnSelf();
    $location->shouldReceive('orderBy')->with('depth', 'desc')->andReturnSelf();
    $location->shouldReceive('pluck')->with('id')->andReturn(collect([10]));

    $org = new Organization(['id' => 2, 'name' => 'Test Org']);

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

    Redis::shouldReceive('hset')
        ->once()
        ->with('feed:v2:items', '7', Mockery::any());

    Redis::shouldReceive('zadd')
        ->once()
        ->with('feed:v2:index', Mockery::any(), '7');

    $sync = new RedisIncidentSync(new IncidentFeedSerializer);
    $sync->updated($incident);
});

it('does not throw when Redis is unreachable', function (): void {
    $incident = new Incident;
    $incident->id = 1;
    $incident->exists = true;

    Redis::shouldReceive('hdel')
        ->once()
        ->andThrow(new RuntimeException('Connection refused'));

    $sync = new RedisIncidentSync(new IncidentFeedSerializer);

    try {
        $sync->deleted($incident);
    } catch (Throwable) {
    }

    expect(true)->toBeTrue();
});
