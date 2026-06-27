<?php

declare(strict_types=1);

use App\Domains\Comments\Models\Comment;
use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Models\Role;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    // Seed role for UserFactory (role_id=1)
    Role::create(['id' => 1, 'name' => 'Admin']);

    $this->user = User::factory()->create();

    $category = IncidentCategory::create(['name' => 'Test Category']);
    $location = Location::create(['name' => 'Test Location', 'level' => 'city']);
    $org = Organization::create([
        'name' => 'Test Org',
        'location_id' => $location->id,
    ]);

    $this->incident = Incident::create([
        'incident_category_id' => $category->id,
        'organization_id' => $org->id,
        'user_id' => $this->user->id,
        'location_id' => $location->id,
        'title' => 'Test Incident',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);
});

it('creates a comment and returns 201', function (): void {
    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->postJson("/api/incidents/{$this->incident->id}/comments", [
            'message' => '¡Se necesita atención urgente!',
        ]);

    $response->assertStatus(201);
    $response->assertJsonStructure([
        'data' => ['id', 'incident_id', 'user_id', 'message'],
    ]);
    $response->assertJsonPath('data.incident_id', $this->incident->id);
});

it('validates required message', function (): void {
    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->postJson("/api/incidents/{$this->incident->id}/comments", []);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['message']);
});

it('validates message max length', function (): void {
    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->postJson("/api/incidents/{$this->incident->id}/comments", [
            'message' => str_repeat('a', 5001),
        ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['message']);
});

it('lists comments for an incident', function (): void {
    Comment::create([
        'incident_id' => $this->incident->id,
        'user_id' => $this->user->id,
        'message' => 'First comment',
    ]);
    Comment::create([
        'incident_id' => $this->incident->id,
        'user_id' => $this->user->id,
        'message' => 'Second comment',
    ]);
    Comment::create([
        'incident_id' => $this->incident->id,
        'user_id' => $this->user->id,
        'message' => 'Third comment',
    ]);

    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->getJson("/api/incidents/{$this->incident->id}/comments");

    $response->assertOk();
    $response->assertJsonCount(3, 'data');
});

it('shows a single comment', function (): void {
    $comment = Comment::create([
        'incident_id' => $this->incident->id,
        'user_id' => $this->user->id,
        'message' => 'Test message',
    ]);

    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->getJson("/api/comments/{$comment->id}");

    $response->assertOk();
    $response->assertJsonPath('data.message', 'Test message');
});

it('updates a comment', function (): void {
    $comment = Comment::create([
        'incident_id' => $this->incident->id,
        'user_id' => $this->user->id,
        'message' => 'Original message',
    ]);

    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->putJson("/api/comments/{$comment->id}", [
            'message' => 'Updated message',
        ]);

    $response->assertOk();
    $response->assertJsonPath('data.message', 'Updated message');
});

it('deletes a comment (soft)', function (): void {
    $comment = Comment::create([
        'incident_id' => $this->incident->id,
        'user_id' => $this->user->id,
        'message' => 'To be deleted',
    ]);

    $response = $this->withoutMiddleware([JwtAuthenticate::class])
        ->actingAs($this->user)
        ->deleteJson("/api/comments/{$comment->id}");

    $response->assertStatus(204);
    $this->assertSoftDeleted('comments', ['id' => $comment->id]);
});
