<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Models\Role;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Role::create(['id' => 1, 'name' => 'Admin']);

    $this->user = User::factory()->create();
    $this->category = IncidentCategory::create(['name' => 'Test Category']);
    $this->location = Location::create(['name' => 'Test Location', 'level' => 'city']);
    $this->org = Organization::create([
        'name' => 'Test Org',
        'location_id' => $this->location->id,
    ]);

    Storage::fake('s3');
});

// ─── Upload through incident creation ───────────────────────────────

it('uploads images when creating an incident', function (): void {
    $file = UploadedFile::fake()->image('incidencia.jpg', 800, 600);

    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->post('/api/incidents', [
            'title' => 'Test with image',
            'incident_category_id' => $this->category->id,
            'location_id' => $this->location->id,
            'priority' => Incident::PRIORITY_MEDIUM,
            'images' => [$file],
        ]);

    $response->assertStatus(201);
    $response->assertJsonStructure([
        'data' => [
            'id', 'title', 'thumbnail_url', 'images',
        ],
    ]);

    // La metadata de imágenes se guarda en el JSON de la incidencia
    $incidentId = $response->json('data.id');
    $incident = Incident::find($incidentId);

    expect($incident->images)->toBeArray();
    expect($incident->images)->toHaveCount(1);
    expect($incident->images[0]['original_name'])->toBe('incidencia.jpg');
    expect($incident->images[0]['is_thumbnail'])->toBeTrue();
});

it('uploads images when updating an incident', function (): void {
    $incident = Incident::create([
        'incident_category_id' => $this->category->id,
        'organization_id' => $this->org->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'title' => 'Test',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);

    $file = UploadedFile::fake()->image('update.jpg');

    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->patch("/api/incidents/{$incident->id}", [
            'title' => 'Updated',
            'images' => [$file],
        ]);

    $response->assertOk();
    $response->assertJsonPath('data.title', 'Updated');
    $response->assertJsonStructure(['data' => ['images']]);

    $incident->refresh();
    expect($incident->images)->toHaveCount(1);
    expect($incident->images[0]['original_name'])->toBe('update.jpg');
    expect($incident->images[0]['is_thumbnail'])->toBeTrue();
});

// ─── Validation ──────────────────────────────────────────────────────

it('validates image mime type', function (): void {
    $file = UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf');

    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->post('/api/incidents', [
            'title' => 'Test',
            'incident_category_id' => $this->category->id,
            'location_id' => $this->location->id,
            'priority' => Incident::PRIORITY_MEDIUM,
            'images' => [$file],
        ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['images.0']);
});

it('rejects images over 10MB', function (): void {
    $file = UploadedFile::fake()->image('huge.jpg')->size(11000); // 11MB

    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->post('/api/incidents', [
            'title' => 'Test',
            'incident_category_id' => $this->category->id,
            'location_id' => $this->location->id,
            'priority' => Incident::PRIORITY_MEDIUM,
            'images' => [$file],
        ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['images.0']);
});

// ─── Thumbnail behavior ──────────────────────────────────────────────

it('first uploaded image becomes thumbnail', function (): void {
    $incident = Incident::create([
        'incident_category_id' => $this->category->id,
        'organization_id' => $this->org->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'title' => 'Thumbnail test',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);

    $file1 = UploadedFile::fake()->image('first.jpg');
    $file2 = UploadedFile::fake()->image('second.jpg');

    // First batch — two images, only first should be thumbnail
    $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->patch("/api/incidents/{$incident->id}", [
            'images' => [$file1, $file2],
        ]);

    $incident->refresh();
    expect($incident->images)->toHaveCount(2);
    expect($incident->images[0]['original_name'])->toBe('first.jpg');
    expect($incident->images[0]['is_thumbnail'])->toBeTrue();
    expect($incident->images[1]['original_name'])->toBe('second.jpg');
    expect($incident->images[1]['is_thumbnail'])->toBeFalse();

    // Third image — no thumbnail because it already has one
    $file3 = UploadedFile::fake()->image('third.jpg');
    $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->patch("/api/incidents/{$incident->id}", [
            'images' => [$file3],
        ]);

    $incident->refresh();
    expect($incident->images)->toHaveCount(3);
    expect($incident->images[2]['original_name'])->toBe('third.jpg');
    expect($incident->images[2]['is_thumbnail'])->toBeFalse();
});

// ─── Images in show response ─────────────────────────────────────────

it('includes images and thumbnail when showing an incident', function (): void {
    $incident = Incident::create([
        'incident_category_id' => $this->category->id,
        'organization_id' => $this->org->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'title' => 'Detail view test',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
        'images' => [
            [
                'path' => 'images/1/a.jpg',
                'original_name' => 'a.jpg',
                'mime_type' => 'image/jpeg',
                'size' => 512,
                'is_thumbnail' => true,
            ],
            [
                'path' => 'images/1/b.jpg',
                'original_name' => 'b.jpg',
                'mime_type' => 'image/jpeg',
                'size' => 1024,
                'is_thumbnail' => false,
            ],
        ],
    ]);

    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->getJson("/api/incidents/{$incident->id}");

    $response->assertOk();
    $response->assertJsonStructure([
        'data' => [
            'thumbnail_url',
            'images' => [
                '*' => ['id', 'url', 'original_name', 'is_thumbnail'],
            ],
        ],
    ]);
    $response->assertJsonCount(2, 'data.images');
});
