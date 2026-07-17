<?php

declare(strict_types=1);

use App\Domains\Comments\Models\Comment;
use App\Domains\Comments\Models\CommentImage;
use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(PermissionSeeder::class);
    $this->seed(RoleSeeder::class);
    $this->seed(RolePermissionSeeder::class);
});

it('belongs to comment', function (): void {
    $category = IncidentCategory::create(['name' => 'Cat']);
    $location = Location::create(['name' => 'Loc', 'level' => 'city']);
    $org = Organization::create(['name' => 'Org', 'location_id' => $location->id]);
    $user = User::factory()->create();
    $incident = Incident::create([
        'incident_category_id' => $category->id,
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'location_id' => $location->id,
        'title' => 'Test',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);
    $comment = Comment::create([
        'incident_id' => $incident->id,
        'user_id' => $user->id,
        'message' => 'Hello',
    ]);

    $image = CommentImage::create([
        'comment_id' => $comment->id,
        'url' => 'comments/1/uuid.webp',
        'caption' => null,
        'sort_order' => 0,
    ]);

    expect($image->comment)->toBeInstanceOf(Comment::class);
    expect($image->comment->id)->toBe($comment->id);
});

it('has correct fillable attributes', function (): void {
    $fillable = (new CommentImage())->getFillable();

    expect($fillable)->toContain('comment_id')
        ->toContain('url')
        ->toContain('caption')
        ->toContain('sort_order');
});

it('casts sort_order to integer', function (): void {
    $category = IncidentCategory::create(['name' => 'Cat']);
    $location = Location::create(['name' => 'Loc', 'level' => 'city']);
    $org = Organization::create(['name' => 'Org', 'location_id' => $location->id]);
    $user = User::factory()->create();
    $incident = Incident::create([
        'incident_category_id' => $category->id,
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'location_id' => $location->id,
        'title' => 'Test',
        'status' => Incident::STATUS_PENDING,
        'priority' => Incident::PRIORITY_MEDIUM,
    ]);
    $comment = Comment::create([
        'incident_id' => $incident->id,
        'user_id' => $user->id,
        'message' => 'Hello',
    ]);

    $image = CommentImage::create([
        'comment_id' => $comment->id,
        'url' => 'comments/1/uuid.webp',
        'caption' => 'A caption',
        'sort_order' => '5',
    ]);

    expect($image->sort_order)->toBe(5);
});
