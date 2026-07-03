<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    // Seed role for UserFactory (role_id=1)
    DB::table('roles')->insert(['id' => 1, 'name' => 'Admin']);

    $user = User::factory()->create();
    $category = IncidentCategory::create(['name' => 'Test']);
    $location = Location::create(['name' => 'Test Loc', 'level' => 'city']);
    $org = Organization::create(['name' => 'Test Org', 'location_id' => $location->id]);

    Incident::create([
        'incident_category_id' => $category->id,
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'location_id' => $location->id,
        'title' => 'Test Incident',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);
});

it('rebuilds the Redis feed from PostgreSQL', function (): void {
    // Pipeline for incidents: hset + zadd
    Redis::shouldReceive('pipeline')
        ->once()
        ->andReturnSelf();

    Redis::shouldReceive('hset')
        ->once()
        ->with('feed:v2:items', Mockery::type('string'), Mockery::type('string'));

    Redis::shouldReceive('zadd')
        ->once()
        ->with('feed:v2:index', Mockery::type('float'), Mockery::type('string'));

    Redis::shouldReceive('exec')
        ->once();

    // TTL on v2 keys + old key
    Redis::shouldReceive('expire')
        ->once()
        ->with('feed:v2:items', 604800);

    Redis::shouldReceive('expire')
        ->once()
        ->with('feed:v2:index', 604800);

    Redis::shouldReceive('expire')
        ->once()
        ->with('feed:incidents', 604800);

    $this->artisan('feed:rebuild')
        ->expectsOutputToContain('Synced 1 incidents to Redis feed v2.')
        ->assertExitCode(0);
});
