<?php

declare(strict_types=1);

use App\Domains\Comments\Models\Comment;
use App\Domains\Comments\Models\CommentImage;
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
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(PermissionSeeder::class);
    $this->seed(RoleSeeder::class);
    $this->seed(RolePermissionSeeder::class);

    foreach (Permission::all() as $permission) {
        $slug = "{$permission->resource}.{$permission->action}";
        Gate::define($slug, fn (User $user) => $user->hasPermission($slug));
    }
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

    $this->withoutMiddleware(JwtAuthenticate::class);
    Storage::fake('s3');

    $this->user = User::factory()->create();
    $category = IncidentCategory::create(['name' => 'Test Cat']);
    $location = Location::create(['name' => 'Test Loc', 'level' => 'city']);
    $org = Organization::create(['name' => 'Test Org', 'location_id' => $location->id]);
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
        'message' => 'Test comment',
    ]);
});

it('uploads an image and returns 201 with image data', function (): void {
    $file = UploadedFile::fake()->image('test.jpg', 800, 600);

    $response = $this->actingAs($this->user)
        ->postJson("/api/comments/{$this->comment->id}/images", [
            'images' => [$file],
        ]);

    $response->assertStatus(201);
    $response->assertJsonStructure(['data' => ['*' => ['id', 'comment_id', 'url', 'caption', 'sort_order', 'created_at']]]);
    $response->assertJsonCount(1, 'data');
    $this->assertDatabaseHas('comment_images', ['comment_id' => $this->comment->id]);
    Storage::disk('s3')->assertExists($response->json('data.0.url'));
});

it('uploads multiple images in one request', function (): void {
    $file1 = UploadedFile::fake()->image('test1.jpg', 800, 600);
    $file2 = UploadedFile::fake()->image('test2.png', 1024, 768);

    $response = $this->actingAs($this->user)
        ->postJson("/api/comments/{$this->comment->id}/images", [
            'images' => [$file1, $file2],
        ]);

    $response->assertStatus(201);
    $response->assertJsonCount(2, 'data');
    $this->assertDatabaseCount('comment_images', 2);
});

it('rejects non-image files', function (): void {
    $file = UploadedFile::fake()->create('document.pdf', 512, 'application/pdf');

    $response = $this->actingAs($this->user)
        ->postJson("/api/comments/{$this->comment->id}/images", [
            'images' => [$file],
        ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['images.0']);
});

it('rejects image over 10MB', function (): void {
    $file = UploadedFile::fake()->image('large.jpg')->size(11000);

    $response = $this->actingAs($this->user)
        ->postJson("/api/comments/{$this->comment->id}/images", [
            'images' => [$file],
        ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['images.0']);
});

it('rejects empty images array', function (): void {
    $response = $this->actingAs($this->user)
        ->postJson("/api/comments/{$this->comment->id}/images", [
            'images' => [],
        ]);

    $response->assertStatus(422);
});

it('denies image upload to non-owner', function (): void {
    $stranger = User::factory()->create(['role_id' => 5]);
    $file = UploadedFile::fake()->image('test.jpg', 800, 600);

    $response = $this->actingAs($stranger)
        ->postJson("/api/comments/{$this->comment->id}/images", [
            'images' => [$file],
        ]);

    $response->assertForbidden();
});

it('deletes an image and returns 204', function (): void {
    $image = CommentImage::create([
        'comment_id' => $this->comment->id,
        'url' => 'comments/1/test.webp',
        'caption' => null,
        'sort_order' => 0,
    ]);
    Storage::disk('s3')->put($image->url, 'fake image content');

    $response = $this->actingAs($this->user)
        ->deleteJson("/api/comments/{$this->comment->id}/images/{$image->id}");

    $response->assertStatus(204);
    $this->assertDatabaseMissing('comment_images', ['id' => $image->id]);
    Storage::disk('s3')->assertMissing($image->url);
});

it('denies image delete to non-owner', function (): void {
    $image = CommentImage::create([
        'comment_id' => $this->comment->id,
        'url' => 'comments/1/test.webp',
    ]);
    Storage::disk('s3')->put($image->url, 'fake image content');
    $stranger = User::factory()->create(['role_id' => 5]);

    $response = $this->actingAs($stranger)
        ->deleteJson("/api/comments/{$this->comment->id}/images/{$image->id}");

    $response->assertForbidden();
    $this->assertDatabaseHas('comment_images', ['id' => $image->id]);
});
