<?php

declare(strict_types=1);

use App\Domains\Comments\Models\Comment;
use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use App\Storage\ImageBackfiller;
use App\Storage\Models\Image;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

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

    $this->backfiller = new ImageBackfiller;
});

it('backfills incident images preserving array order and deriving is_thumbnail from index, not the stored flag', function (): void {
    // The JSON flag deliberately disagrees with order (index 0 has
    // is_thumbnail=false in the stored JSON) to prove D5: the backfiller
    // must derive is_thumbnail from array position, matching what
    // IncidentResource actually displays ($images[0]), not the flag.
    $this->incident->update([
        'images' => [
            ['path' => 'incidents/1/a.webp', 'original_name' => 'a.jpg', 'mime_type' => 'image/webp', 'size' => 111, 'is_thumbnail' => false],
            ['path' => 'incidents/1/b.webp', 'original_name' => 'b.jpg', 'mime_type' => 'image/webp', 'size' => 222, 'is_thumbnail' => true],
        ],
    ]);

    $stats = $this->backfiller->backfillIncidents();

    expect($stats['source_count'])->toBe(2);
    expect($stats['created_count'])->toBe(2);

    $rows = Image::where('imageable_type', 'incident')
        ->where('imageable_id', $this->incident->id)
        ->orderBy('sort_order')
        ->get();

    expect($rows)->toHaveLength(2);
    expect($rows[0]->storage_path)->toBe('incidents/1/a.webp');
    expect($rows[0]->original_name)->toBe('a.jpg');
    expect($rows[0]->size)->toBe(111);
    expect($rows[0]->sort_order)->toBe(0);
    expect($rows[0]->is_thumbnail)->toBeTrue();

    expect($rows[1]->storage_path)->toBe('incidents/1/b.webp');
    expect($rows[1]->sort_order)->toBe(1);
    expect($rows[1]->is_thumbnail)->toBeFalse();
});

it('is idempotent for incidents: running backfillIncidents twice creates no duplicate rows', function (): void {
    $this->incident->update([
        'images' => [
            ['path' => 'incidents/1/a.webp', 'original_name' => 'a.jpg', 'mime_type' => 'image/webp', 'size' => 111, 'is_thumbnail' => true],
        ],
    ]);

    $first = $this->backfiller->backfillIncidents();
    $second = $this->backfiller->backfillIncidents();

    expect($first['created_count'])->toBe(1);
    expect($second['created_count'])->toBe(0);
    expect($second['source_count'])->toBe(1);
    expect(Image::where('imageable_type', 'incident')->count())->toBe(1);
});

it('backfills a normal bare-key comment_images row, preserving caption and sort_order', function (): void {
    DB::table('comment_images')->insert([
        'comment_id' => $this->comment->id,
        'url' => 'comments/'.$this->comment->id.'/x.webp',
        'caption' => 'a nice photo',
        'sort_order' => 3,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $stats = $this->backfiller->backfillComments();

    expect($stats['source_count'])->toBe(1);
    expect($stats['created_count'])->toBe(1);
    expect($stats['legacy_url_rows'])->toBe([]);

    $row = Image::where('imageable_type', 'comment')->where('imageable_id', $this->comment->id)->first();

    expect($row)->not->toBeNull();
    expect($row->storage_path)->toBe('comments/'.$this->comment->id.'/x.webp');
    expect($row->caption)->toBe('a nice photo');
    expect($row->sort_order)->toBe(3);
});

it('copies a legacy absolute-URL comment_images row verbatim into storage_path and reports it, never guessing a bare key', function (): void {
    $legacyUrl = 'https://old-cdn.example.com/legacy/comment-photo.jpg';

    DB::table('comment_images')->insert([
        'comment_id' => $this->comment->id,
        'url' => $legacyUrl,
        'caption' => null,
        'sort_order' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $stats = $this->backfiller->backfillComments();

    expect($stats['created_count'])->toBe(1);
    expect($stats['legacy_url_rows'])->toBe([
        ['imageable_id' => $this->comment->id, 'storage_path' => $legacyUrl],
    ]);

    $row = Image::where('imageable_type', 'comment')->where('imageable_id', $this->comment->id)->first();

    // Verbatim copy — never mangled, never reverse-derived into a bare key.
    expect($row->storage_path)->toBe($legacyUrl);
});

it('is idempotent for comments: running backfillComments twice creates no duplicate rows', function (): void {
    DB::table('comment_images')->insert([
        'comment_id' => $this->comment->id,
        'url' => 'comments/'.$this->comment->id.'/x.webp',
        'caption' => null,
        'sort_order' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $first = $this->backfiller->backfillComments();
    $second = $this->backfiller->backfillComments();

    expect($first['created_count'])->toBe(1);
    expect($second['created_count'])->toBe(0);
    expect(Image::where('imageable_type', 'comment')->count())->toBe(1);
});

it('creates exactly one avatar row with is_thumbnail=true per user', function (): void {
    $this->user->update(['profile_image_path' => 'users/'.$this->user->id.'/avatar.webp']);

    $stats = $this->backfiller->backfillUsers();

    expect($stats['source_count'])->toBe(1);
    expect($stats['created_count'])->toBe(1);

    $rows = Image::where('imageable_type', 'user')->where('imageable_id', $this->user->id)->get();

    expect($rows)->toHaveLength(1);
    expect($rows[0]->storage_path)->toBe('users/'.$this->user->id.'/avatar.webp');
    expect($rows[0]->is_thumbnail)->toBeTrue();
});

it('is idempotent for users: running backfillUsers twice creates no duplicate rows', function (): void {
    $this->user->update(['profile_image_path' => 'users/'.$this->user->id.'/avatar.webp']);

    $first = $this->backfiller->backfillUsers();
    $second = $this->backfiller->backfillUsers();

    expect($first['created_count'])->toBe(1);
    expect($second['created_count'])->toBe(0);
    expect(Image::where('imageable_type', 'user')->count())->toBe(1);
});

it('skips users with no profile_image_path', function (): void {
    // $this->user has no profile_image_path set (null by default).
    $stats = $this->backfiller->backfillUsers();

    expect($stats['source_count'])->toBe(0);
    expect($stats['created_count'])->toBe(0);
    expect(Image::where('imageable_type', 'user')->count())->toBe(0);
});

it('verify() reports source vs already-backfilled target counts without writing anything', function (): void {
    $this->incident->update([
        'images' => [
            ['path' => 'incidents/1/a.webp', 'original_name' => 'a.jpg', 'mime_type' => 'image/webp', 'size' => 111, 'is_thumbnail' => true],
            ['path' => 'incidents/1/b.webp', 'original_name' => 'b.jpg', 'mime_type' => 'image/webp', 'size' => 222, 'is_thumbnail' => false],
        ],
    ]);

    $before = $this->backfiller->verify('incidents');

    expect($before)->toBe(['source_count' => 2, 'target_count' => 0]);
    expect(Image::count())->toBe(0);

    $this->backfiller->backfillIncidents();

    $after = $this->backfiller->verify('incidents');

    expect($after)->toBe(['source_count' => 2, 'target_count' => 2]);
});
