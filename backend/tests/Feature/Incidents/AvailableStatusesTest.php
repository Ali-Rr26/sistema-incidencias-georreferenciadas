<?php

declare(strict_types=1);

use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Statuses\Models\Status;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('returns active statuses from DB as plain array', function (): void {
    $this->withoutMiddleware(JwtAuthenticate::class);

    // Seed statuses directly (StatusSeeder normally runs via DatabaseSeeder)
    Status::create(['nombre' => 'Pendiente', 'valor' => IncidentStatus::Pending->value, 'activo' => true]);
    Status::create(['nombre' => 'En proceso', 'valor' => IncidentStatus::InProgress->value, 'activo' => true]);
    Status::create(['nombre' => 'Resuelto', 'valor' => IncidentStatus::Resolved->value, 'activo' => true]);
    // Inactive status should not appear
    Status::create(['nombre' => 'Cerrado', 'valor' => 'closed', 'activo' => false]);

    $response = $this->getJson('/api/estados');

    $response->assertOk();

    // Should be a plain array, not wrapped in {"data": [...]}
    $data = $response->json();
    expect($data)->toBeArray()
        ->and($data)->not->toHaveKey('data');

    // Should contain only active statuses
    expect(count($data))->toBe(3);

    // Verify structure and values
    expect($data[0])->toMatchArray(['id' => 1, 'nombre' => 'Pendiente', 'valor' => 'pending']);
    expect($data[1])->toMatchArray(['id' => 2, 'nombre' => 'En proceso', 'valor' => 'in_progress']);
    expect($data[2])->toMatchArray(['id' => 3, 'nombre' => 'Resuelto', 'valor' => 'resolved']);
});
