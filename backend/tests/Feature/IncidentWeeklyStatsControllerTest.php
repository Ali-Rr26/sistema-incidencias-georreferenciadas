<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('returns weekly stats with correct structure', function () {
    $this->withoutMiddleware(JwtAuthenticate::class);

    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema', 'created_at' => now(), 'updated_at' => now()],
    ]);
    $admin = User::factory()->create(['role_id' => 1]);

    $response = $this->actingAs($admin)->getJson('/api/incidents/weekly-stats');

    $response->assertOk()
        ->assertJsonStructure([
            'days' => [
                '*' => ['date', 'label', 'recibidas', 'resueltas'],
            ],
        ]);

    // Should return 7 days by default
    $days = $response->json('days');
    expect($days)->not->toBeEmpty();
    expect(count($days))->toBeGreaterThanOrEqual(6); // Allow for timezone differences
});

it('returns correct counts for incidents', function () {
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

    $today = now()->startOfDay();
    Incident::create([
        'title' => 'Today incident',
        'incident_category_id' => $category->id,
        'user_id' => $admin->id,
        'location_id' => $location->id,
        'organization_id' => $org->id,
        'status' => IncidentStatus::Pending,
        'priority' => 'medium',
        'created_at' => $today,
    ]);

    $response = $this->actingAs($admin)->getJson('/api/incidents/weekly-stats');

    $response->assertOk();
    expect($response->json('days'))->not->toBeEmpty();
});

it('respects custom date range filter', function () {
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

    // Create incidents over several days
    $start = now()->subDays(10)->startOfDay();
    for ($i = 0; $i < 5; $i++) {
        Incident::create([
            'title' => "Incident $i",
            'incident_category_id' => $category->id,
            'user_id' => $admin->id,
            'location_id' => $location->id,
            'organization_id' => $org->id,
            'status' => IncidentStatus::Pending,
            'priority' => 'medium',
            'created_at' => $start->copy()->addDays($i),
        ]);
    }

    // Request with custom date range
    $rangeStart = $start->copy()->addDay()->format('Y-m-d');
    $rangeEnd = $start->copy()->addDays(3)->format('Y-m-d');

    $response = $this->actingAs($admin)->getJson(
        "/api/incidents/weekly-stats?inicio={$rangeStart}&fin={$rangeEnd}"
    );

    $response->assertOk();

    $days = $response->json('days');
    expect($days)->toHaveCount(3); // 3 days in range

    expect($days[0]['date'])->toBe($rangeStart);
    expect($days[2]['date'])->toBe($rangeEnd);
});

it('separates received vs resolved incidents correctly', function () {
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

    $response = $this->actingAs($admin)->getJson('/api/incidents/weekly-stats');

    $response->assertOk()
        ->assertJsonStructure([
            'days' => [
                '*' => ['date', 'label', 'recibidas', 'resueltas'],
            ],
        ]);
});

it('requires dashboard.view permission', function () {
    $this->withoutMiddleware(JwtAuthenticate::class);

    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema', 'created_at' => now(), 'updated_at' => now()],
        ['id' => 2, 'name' => 'user_regular', 'created_at' => now(), 'updated_at' => now()],
    ]);

    $adminWithPerm = User::factory()->create(['role_id' => 1]);
    $userWithoutPerm = User::factory()->create(['role_id' => 2]);

    $response = $this->actingAs($adminWithPerm)->getJson('/api/incidents/weekly-stats');
    $response->assertOk();

    $response2 = $this->actingAs($userWithoutPerm)->getJson('/api/incidents/weekly-stats');
    $response2->assertStatus(403);
});