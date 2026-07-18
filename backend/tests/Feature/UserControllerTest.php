<?php

declare(strict_types=1);

/**
 * PUT /users/{id} tests for the new avatar handling.
 *
 * Avatar replace/delete now lives inside PUT /users/{id} (multipart FormData
 * for an avatar upload, or a `_delete_avatar=true` JSON flag for removal)
 * — POST /users/{id}/avatar and DELETE /users/{id}/avatar are gone.
 */

use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
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

it('PUT /users/{id} multipart with avatar replaces existing avatar', function (): void {
    $target = User::factory()->create([
        'profile_image_path' => 'users/1/old-uuid.webp',
    ]);
    Storage::disk('s3')->put('users/1/old-uuid.webp', 'old content');

    $admin = User::factory()->create(['role_id' => 1]);
    $file = UploadedFile::fake()->image('avatar.jpg', 512, 512);

    $response = $this->actingAs($admin)->put('/api/users/' . $target->id, [
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
});

it('PUT /users/{id} JSON with _delete_avatar=true removes the avatar', function (): void {
    $target = User::factory()->create([
        'profile_image_path' => 'users/1/existing.webp',
    ]);
    Storage::disk('s3')->put('users/1/existing.webp', 'existing avatar');

    $admin = User::factory()->create(['role_id' => 1]);

    $response = $this->actingAs($admin)->putJson('/api/users/' . $target->id, [
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
    expect($target->fresh()->profile_image_path)->toBeNull();
    Storage::disk('s3')->assertMissing('users/1/existing.webp');
});

it('PUT /users/{id} JSON text-only preserves the existing avatar', function (): void {
    $target = User::factory()->create([
        'profile_image_path' => 'users/1/keep-me.webp',
        'first_name' => 'Old',
    ]);

    $admin = User::factory()->create(['role_id' => 1]);

    $response = $this->actingAs($admin)->putJson('/api/users/' . $target->id, [
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
    $target = User::factory()->create([
        'profile_image_path' => 'users/1/also-keep.webp',
    ]);

    $admin = User::factory()->create(['role_id' => 1]);

    // Multipart request without an avatar file in the payload.
    $response = $this->actingAs($admin)->put('/api/users/' . $target->id, [
        'first_name' => 'Renamed',
    ]);

    $response->assertStatus(200);
    expect($response->json('data.first_name'))->toBe('Renamed');
    expect($response->json('data.profile_image_path'))->toBe('users/1/also-keep.webp');
});

it('PUT /users/{id} rejects oversized avatar file', function (): void {
    $target = User::factory()->create();
    $admin = User::factory()->create(['role_id' => 1]);

    // 801 KB — over the 800 KB cap defined by User::AVATAR_MAX_KB.
    $file = UploadedFile::fake()->image('big.jpg')->size(801);

    $response = $this->actingAs($admin)->put('/api/users/' . $target->id, [
        'first_name' => 'X',
        'avatar' => $file,
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['avatar']);
});

it('PUT /users/{id} rejects wrong MIME type avatar', function (): void {
    $target = User::factory()->create();
    $admin = User::factory()->create(['role_id' => 1]);

    $file = UploadedFile::fake()->create('avatar.gif', 100, 'image/gif');

    $response = $this->actingAs($admin)->put('/api/users/' . $target->id, [
        'first_name' => 'X',
        'avatar' => $file,
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['avatar']);
});

it('PUT /users/{id} accepts avatar at exactly 800KB', function (): void {
    $target = User::factory()->create();
    $admin = User::factory()->create(['role_id' => 1]);

    $file = UploadedFile::fake()->image('avatar.jpg')->size(800);

    $response = $this->actingAs($admin)->put('/api/users/' . $target->id, [
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
