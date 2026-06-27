<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Redis;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->redis = Mockery::mock('alias:' . Redis::class);

    // Seed role for UserFactory (role_id=1)
    Role::create(['id' => 1, 'name' => 'Admin']);

    $user = User::factory()->create();
    $category = IncidentCategory::create(['name' => 'Test']);
    $location = Location::create(['name' => 'Test Loc', 'level' => 'city']);
    $org = Organization::create(['name' => 'Test Org', 'location_id' => $location->id]);

    Incident::create([
        'incident_category_id' => $category->id,
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'location_id' => $location->id,
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);
});

it('rebuilds the Redis feed from PostgreSQL', function (): void {
    $this->redis->shouldReceive('del')
        ->once()
        ->with(Mockery::pattern('/.*feed:incidents$/'));

    // Pipeline: hmset + zadd per incident
    $this->redis->shouldReceive('pipeline')
        ->once()
        ->andReturnSelf();

    $this->redis->shouldReceive('hmset')
        ->once()
        ->with(Mockery::pattern('/^incident:\d+$/'), Mockery::type('array'));

    $this->redis->shouldReceive('zadd')
        ->once()
        ->with('feed:incidents', Mockery::type('float'), Mockery::type('string'));

    $this->redis->shouldReceive('exec')
        ->once();

    $this->artisan('feed:rebuild')
        ->expectsOutputToContain('Synced 1 incidents to Redis.')
        ->assertExitCode(0);
});
