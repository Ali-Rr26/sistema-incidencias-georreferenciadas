<?php

declare(strict_types=1);

/**
 * PUT /users/{id} tests for the new avatar handling.
 *
 * Avatar replace/delete now lives inside PUT /users/{id} (multipart FormData
 * for an avatar upload, or a `_delete_avatar=true` JSON flag for removal)
 * — POST /users/{id}/avatar and DELETE /users/{id}/avatar are gone.
 *
 * Avatars are seeded via the shared `images` table (image-persistence-
 * polymorphic WU7 cutover) rather than the legacy `profile_image_path`
 * column — that column is now dead (WU8 drops it), and `UserResource`
 * sources `profile_image_path` from the `avatarImage()` relation instead.
 */

use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use App\Storage\ImageRules;
use App\Storage\Models\Image;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert(['id' => 1, 'name' => 'admin_sistema']);
    Storage::fake('s3');
    $this->withoutMiddleware(JwtAuthenticate::class);
});

function seedAvatar(User $user, string $path): Image
{
    Storage::disk('s3')->put($path, 'seeded avatar content');

    return Image::create([
        'imageable_type' => 'user',
        'imageable_id' => $user->id,
        'storage_path' => $path,
        'is_thumbnail' => true,
        'sort_order' => 0,
    ]);
}

it('PUT /users/{id} multipart with avatar replaces existing avatar', function (): void {
    $target = User::factory()->create();
    seedAvatar($target, 'users/1/old-uuid.webp');

    $admin = User::factory()->create(['role_id' => 1]);
    $file = UploadedFile::fake()->image('avatar.jpg', 512, 512);

    $response = $this->actingAs($admin)->put('/api/users/'.$target->id, [
        'first_name' => 'Juan',
        'last_name' => 'Perez',
        'email' => $target->email,
        'role_id' => 1,
        'organization_id' => null,
        'phone' => '0999999999',
        'avatar' => $file,
    ]);

    $response->assertStatus(200);
    $newPath = $response->json('data.profile_image_path');
    expect($newPath)->toBeString()->toStartWith('users/')->toEndWith('.webp');
    expect($newPath)->not->toBe('users/1/old-uuid.webp');
    Storage::disk('s3')->assertMissing('users/1/old-uuid.webp');
    Storage::disk('s3')->assertExists($newPath);
    expect(Image::where('imageable_type', 'user')->where('imageable_id', $target->id)->count())->toBe(1);
});

it('PUT /users/{id} JSON with _delete_avatar=true removes the avatar', function (): void {
    $target = User::factory()->create();
    seedAvatar($target, 'users/1/existing.webp');

    $admin = User::factory()->create(['role_id' => 1]);

    $response = $this->actingAs($admin)->putJson('/api/users/'.$target->id, [
        'first_name' => 'Juan',
        'last_name' => 'Perez',
        'email' => $target->email,
        'role_id' => 1,
        'organization_id' => null,
        'phone' => null,
        '_delete_avatar' => true,
    ]);

    $response->assertStatus(200);
    expect($response->json('data.profile_image_path'))->toBeNull();
    expect(Image::where('imageable_type', 'user')->where('imageable_id', $target->id)->count())->toBe(0);
    Storage::disk('s3')->assertMissing('users/1/existing.webp');
});

it('PUT /users/{id} JSON text-only preserves the existing avatar', function (): void {
    $target = User::factory()->create([
        'first_name' => 'Old',
    ]);
    seedAvatar($target, 'users/1/keep-me.webp');

    $admin = User::factory()->create(['role_id' => 1]);

    $response = $this->actingAs($admin)->putJson('/api/users/'.$target->id, [
        'first_name' => 'New Name',
        'last_name' => $target->last_name,
        'email' => $target->email,
        'role_id' => $target->role_id,
        'organization_id' => null,
        'phone' => $target->phone,
    ]);

    $response->assertStatus(200);
    expect($response->json('data.first_name'))->toBe('New Name');
    // Existing avatar must NOT change when no _delete_avatar flag is set
    // and no file is uploaded.
    expect($response->json('data.profile_image_path'))->toBe('users/1/keep-me.webp');
});

it('PUT /users/{id} multipart without avatar file preserves the existing avatar', function (): void {
    $target = User::factory()->create();
    seedAvatar($target, 'users/1/also-keep.webp');

    $admin = User::factory()->create(['role_id' => 1]);

    // Multipart request without an avatar file in the payload.
    $response = $this->actingAs($admin)->put('/api/users/'.$target->id, [
        'first_name' => 'Renamed',
    ]);

    $response->assertStatus(200);
    expect($response->json('data.first_name'))->toBe('Renamed');
    expect($response->json('data.profile_image_path'))->toBe('users/1/also-keep.webp');
});

it('PUT /users/{id} rejects oversized avatar file', function (): void {
    $target = User::factory()->create();
    $admin = User::factory()->create(['role_id' => 1]);

    // 5200 KB — over ImageRules::MAX_SIZE_KB (5120 KB / 5 MB), the shared
    // D10 cap now enforced for avatars too (WU7 cutover).
    $file = UploadedFile::fake()->image('big.jpg')->size(5200);

    $response = $this->actingAs($admin)->put('/api/users/'.$target->id, [
        'first_name' => 'X',
        'avatar' => $file,
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['avatar']);
});

it('PUT /users/{id} rejects wrong MIME type avatar', function (): void {
    $target = User::factory()->create();
    $admin = User::factory()->create(['role_id' => 1]);

    // bmp is not in ImageRules::MIMES (jpeg,png,webp,gif).
    $file = UploadedFile::fake()->create('avatar.bmp', 100, 'image/bmp');

    $response = $this->actingAs($admin)->put('/api/users/'.$target->id, [
        'first_name' => 'X',
        'avatar' => $file,
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['avatar']);
});

it('PUT /users/{id} accepts avatar at exactly the ImageRules size cap', function (): void {
    $target = User::factory()->create();
    $admin = User::factory()->create(['role_id' => 1]);

    $file = UploadedFile::fake()->image('avatar.jpg')->size(ImageRules::MAX_SIZE_KB);

    $response = $this->actingAs($admin)->put('/api/users/'.$target->id, [
        'first_name' => $target->first_name,
        'last_name' => $target->last_name,
        'email' => $target->email,
        'role_id' => $target->role_id,
        'organization_id' => null,
        'phone' => $target->phone,
        'avatar' => $file,
    ]);

    $response->assertStatus(200);
    $newPath = $response->json('data.profile_image_path');
    expect($newPath)->toBeString()->toStartWith('users/');
});
