<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Enums\IncidentPriority;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('exposes values() on the incident enums', function () {
    expect(IncidentStatus::values())
        ->toBe(['pending', 'in_progress', 'resolved'])
        ->and(IncidentPriority::values())
        ->toBe(['low', 'medium', 'high']);
});

it('returns the stats payload with zero-filled known enum values', function () {
    $this->withoutMiddleware(JwtAuthenticate::class);

    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema', 'created_at' => now(), 'updated_at' => now()],
    ]);
    $admin = User::factory()->create(['role_id' => 1]);

    $response = $this->actingAs($admin)->getJson('/api/incidents/stats');

    $response->assertOk()
        ->assertJsonStructure([
            'total',
            'by_status' => ['pending', 'in_progress', 'resolved'],
            'by_priority' => ['low', 'medium', 'high'],
            'recent_count',
            'locations_count',
            'average_resolution_time',
        ]);
});

it('returns null for average_resolution_time when there are no resolved incidents', function () {
    $this->withoutMiddleware(JwtAuthenticate::class);

    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema', 'created_at' => now(), 'updated_at' => now()],
    ]);
    $admin = User::factory()->create(['role_id' => 1]);

    $response = $this->actingAs($admin)->getJson('/api/incidents/stats');

    $response->assertOk()
        ->assertJsonPath('average_resolution_time', null);
});

it('calculates average_resolution_time correctly for resolved incidents', function () {
    $this->withoutMiddleware(JwtAuthenticate::class);

    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema', 'created_at' => now(), 'updated_at' => now()],
    ]);
    $admin = User::factory()->create(['role_id' => 1]);

    $createdAt = now()->subDays(5);
    $resolutionDate = $createdAt->copy()->addDays(2)->addHours(4);

    $location = Location::create(['name' => 'HQ', 'level' => 'city']);
    $org = Organization::create([
        'name' => 'Test Org',
        'location_id' => $location->id,
    ]);
    $category = IncidentCategory::create([
        'name' => 'General',
        'organization_id' => $org->id,
    ]);

    // Create incident 1: resolved in 2d 4h (52h = 187200s)
    $inc1 = Incident::create([
        'title' => 'Incident 1',
        'incident_category_id' => $category->id,
        'user_id' => $admin->id,
        'location_id' => $location->id,
        'organization_id' => $org->id,
        'status' => IncidentStatus::Resolved,
        'priority' => 'medium',
        'resolution_date' => $resolutionDate,
    ]);
    $inc1->created_at = $createdAt;
    $inc1->save(['timestamps' => false]);

    // Create incident 2: resolved in 0d 8h (8h = 28800s)
    // Total resolved = 2, average = (52 + 8) / 2 = 30 hours (1 day, 6 hours)
    $createdAt2 = now()->subDays(3);
    $resolutionDate2 = $createdAt2->copy()->addHours(8);
    $inc2 = Incident::create([
        'title' => 'Incident 2',
        'incident_category_id' => $category->id,
        'user_id' => $admin->id,
        'location_id' => $location->id,
        'organization_id' => $org->id,
        'status' => IncidentStatus::Resolved,
        'priority' => 'medium',
        'resolution_date' => $resolutionDate2,
    ]);
    $inc2->created_at = $createdAt2;
    $inc2->save(['timestamps' => false]);

    // Create incident 3: not resolved (should not be included in resolution time average)
    Incident::create([
        'title' => 'Incident 3',
        'incident_category_id' => $category->id,
        'user_id' => $admin->id,
        'location_id' => $location->id,
        'organization_id' => $org->id,
        'status' => IncidentStatus::InProgress,
        'priority' => 'medium',
        'created_at' => now(),
    ]);

    $response = $this->actingAs($admin)->getJson('/api/incidents/stats');

    $response->assertOk()
        ->assertJsonStructure([
            'total',
            'by_status',
            'by_priority',
            'recent_count',
            'locations_count',
            'average_resolution_time' => [
                'formatted',
                'days',
                'hours',
                'seconds',
            ],
        ])
        ->assertJsonPath('average_resolution_time.days', 1)
        ->assertJsonPath('average_resolution_time.hours', 6)
        ->assertJsonPath('average_resolution_time.formatted', '1d 6h');
});

it('excludes soft-deleted incidents from total, by_status, and average_resolution_time', function () {
    // DB::table('incidents') (query builder) never applies Eloquent's
    // SoftDeletingScope — without an explicit whereNull('deleted_at') in
    // IncidentStatsController, a soft-deleted row still counts toward
    // total/by_status/by_priority and skews average_resolution_time.
    $this->withoutMiddleware(JwtAuthenticate::class);

    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema', 'created_at' => now(), 'updated_at' => now()],
    ]);
    $admin = User::factory()->create(['role_id' => 1]);

    $location = Location::create(['name' => 'HQ', 'level' => 'city']);
    $org = Organization::create([
        'name' => 'Test Org',
        'location_id' => $location->id,
    ]);
    $category = IncidentCategory::create([
        'name' => 'General',
        'organization_id' => $org->id,
    ]);

    $visible = Incident::create([
        'title' => 'Visible incident',
        'incident_category_id' => $category->id,
        'user_id' => $admin->id,
        'location_id' => $location->id,
        'organization_id' => $org->id,
        'status' => IncidentStatus::Pending,
        'priority' => 'medium',
    ]);

    // Resolved in 100 hours — wildly different from any visible resolved
    // incident, so if this leaks into the average the test fails loudly
    // rather than passing by coincidence.
    $deleted = Incident::create([
        'title' => 'Soft-deleted incident',
        'incident_category_id' => $category->id,
        'user_id' => $admin->id,
        'location_id' => $location->id,
        'organization_id' => $org->id,
        'status' => IncidentStatus::Resolved,
        'priority' => 'medium',
        'resolution_date' => now(),
    ]);
    $deleted->created_at = now()->subHours(100);
    $deleted->save(['timestamps' => false]);
    $deleted->delete();

    $response = $this->actingAs($admin)->getJson('/api/incidents/stats');

    $response->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('by_status.pending', 1)
        ->assertJsonPath('by_status.resolved', 0)
        ->assertJsonPath('average_resolution_time', null);
});
