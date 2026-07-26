<?php

declare(strict_types=1);

use App\Domains\Comments\Models\Comment;
use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Permissions\Models\Permission;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(PermissionSeeder::class);
    $this->seed(RoleSeeder::class);
    $this->seed(RolePermissionSeeder::class);

    // Register dynamic gates from permissions table
    foreach (Permission::all() as $permission) {
        $slug = "{$permission->resource}.{$permission->action}";
        Gate::define($slug, fn (User $user) => $user->hasPermission($slug));
    }

    $this->withoutMiddleware(JwtAuthenticate::class);

    // Grant permissions for test user
    foreach (
        Permission::whereIn('resource', ['comments', 'incidents'])
            ->whereIn('action', ['view', 'create', 'update', 'delete'])
            ->get() as $perm
    ) {
        DB::table('role_permission')->insertOrIgnore([
            'role_id' => 1,
            'permission_id' => $perm->permission_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

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

    $this->comment = Comment::create([
        'incident_id' => $this->incident->id,
        'user_id' => $this->user->id,
        'message' => 'Original comment',
    ]);
});

it('sanitizes XSS script tags in POST comment creation', function (): void {
    $xssPayload = '<script>alert(1)</script>';
    $expectedEscaped = '&lt;script&gt;alert(1)&lt;/script&gt;';

    $response = $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->incident->id}/comments", [
            'message' => $xssPayload,
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.message', $expectedEscaped);

    // Verify in database
    $commentId = $response->json('data.id');
    $storedComment = Comment::findOrFail($commentId);
    expect($storedComment->message)->toBe($expectedEscaped);
    expect($storedComment->message)->not->toContain('<script>');
});

it('sanitizes XSS img onerror in POST comment creation', function (): void {
    $xssPayload = '<img src=x onerror=alert(1)>';
    $expectedEscaped = '&lt;img src=x onerror=alert(1)&gt;';

    $response = $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->incident->id}/comments", [
            'message' => $xssPayload,
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.message', $expectedEscaped);

    // Verify in database
    $commentId = $response->json('data.id');
    $storedComment = Comment::findOrFail($commentId);
    expect($storedComment->message)->toBe($expectedEscaped);
    expect($storedComment->message)->not->toContain('<img');
});

it('sanitizes XSS in PUT comment update', function (): void {
    $xssPayload = '<img src=x onerror=alert(1)>';
    $expectedEscaped = '&lt;img src=x onerror=alert(1)&gt;';

    $response = $this->actingAs($this->user)
        ->putJson("/api/comments/{$this->comment->id}", [
            'message' => $xssPayload,
        ]);

    $response->assertStatus(200);
    $response->assertJsonPath('data.message', $expectedEscaped);

    // Verify in database
    $this->comment->refresh();
    expect($this->comment->message)->toBe($expectedEscaped);
    expect($this->comment->message)->not->toContain('<img');
});

it('escapes HTML entities: ampersand, less than, greater than, quotes', function (): void {
    $xssPayload = 'Test & <tag> "quoted"';
    $expectedEscaped = 'Test &amp; &lt;tag&gt; &quot;quoted&quot;';

    $response = $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->incident->id}/comments", [
            'message' => $xssPayload,
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.message', $expectedEscaped);

    // Verify in database
    $commentId = $response->json('data.id');
    $storedComment = Comment::findOrFail($commentId);
    expect($storedComment->message)->toBe($expectedEscaped);
});

it('preserves regular text without XSS', function (): void {
    $regularMessage = 'This is a regular comment without any HTML tags';

    $response = $this->actingAs($this->user)
        ->postJson("/api/incidents/{$this->incident->id}/comments", [
            'message' => $regularMessage,
        ]);

    $response->assertStatus(201);
    $response->assertJsonPath('data.message', $regularMessage);

    // Verify in database
    $commentId = $response->json('data.id');
    $storedComment = Comment::findOrFail($commentId);
    expect($storedComment->message)->toBe($regularMessage);
});
