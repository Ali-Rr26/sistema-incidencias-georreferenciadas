<?php

declare(strict_types=1);

use App\Domains\Incidents\Enums\IncidentPriority;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('exposes values() on the incident enums', function () {
    expect(IncidentStatus::values())
        ->toBe(['pending', 'pending_operator', 'in_progress', 'resolved'])
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
            'by_status' => ['pending', 'pending_operator', 'in_progress', 'resolved'],
            'by_priority' => ['low', 'medium', 'high'],
            'recent_count',
            'locations_count',
        ]);
});
