<?php

declare(strict_types=1);

use App\Domains\Comments\Models\Comment;
use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use App\Storage\Models\Image;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Role::create(['name' => 'admin_sistema']);

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

it('exposes an ordered images() morphMany relation on Incident', function (): void {
    Image::create([
        'imageable_type' => 'incident',
        'imageable_id' => $this->incident->id,
        'storage_path' => 'incidents/'.$this->incident->id.'/b.webp',
        'sort_order' => 1,
    ]);
    Image::create([
        'imageable_type' => 'incident',
        'imageable_id' => $this->incident->id,
        'storage_path' => 'incidents/'.$this->incident->id.'/a.webp',
        'sort_order' => 0,
    ]);

    $paths = $this->incident->images()->pluck('storage_path')->all();

    expect($paths)->toBe([
        'incidents/'.$this->incident->id.'/a.webp',
        'incidents/'.$this->incident->id.'/b.webp',
    ]);
});

it('exposes an ordered polymorphicImages() morphMany relation on Comment without touching the legacy images() relation', function (): void {
    Image::create([
        'imageable_type' => 'comment',
        'imageable_id' => $this->comment->id,
        'storage_path' => 'comments/'.$this->comment->id.'/b.webp',
        'sort_order' => 1,
    ]);
    Image::create([
        'imageable_type' => 'comment',
        'imageable_id' => $this->comment->id,
        'storage_path' => 'comments/'.$this->comment->id.'/a.webp',
        'sort_order' => 0,
    ]);

    $paths = $this->comment->polymorphicImages()->pluck('storage_path')->all();

    expect($paths)->toBe([
        'comments/'.$this->comment->id.'/a.webp',
        'comments/'.$this->comment->id.'/b.webp',
    ]);

    // Legacy relation is untouched — still resolves via the CommentImage
    // hasMany relation, not the new polymorphic Image model.
    expect($this->comment->images())->toBeInstanceOf(\Illuminate\Database\Eloquent\Relations\HasMany::class);
    expect($this->comment->images()->getRelated())->toBeInstanceOf(\App\Domains\Comments\Models\CommentImage::class);
});

it('exposes an avatarImage() morphOne relation on User', function (): void {
    Image::create([
        'imageable_type' => 'user',
        'imageable_id' => $this->user->id,
        'storage_path' => 'users/'.$this->user->id.'/avatar.webp',
        'is_thumbnail' => true,
        'sort_order' => 0,
    ]);

    $avatar = $this->user->avatarImage()->first();

    expect($avatar)->not->toBeNull();
    expect($avatar->storage_path)->toBe('users/'.$this->user->id.'/avatar.webp');
    expect($avatar->is_thumbnail)->toBeTrue();
});
